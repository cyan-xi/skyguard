import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, TypedDict


ActionName = Literal["stay_pattern", "enter_tangent_hold_circle", "expedite_landing"]


class WoodWideRow(TypedDict, total=False):
    sim_id: str
    sim_time_sec: float
    aircraft_id: str
    callsign: str
    phase: str
    route_segment: str
    ground_speed_kt: float
    heading_deg: float
    altitude_ft: float
    vertical_speed_fpm: float
    distance_to_nearest_nm: float
    vertical_sep_to_nearest_ft: float
    num_instructions_last_30s: int
    time_since_last_instruction_sec: float
    last_instruction_type: str
    action_name: str


@dataclass
class PlaneContext:
    sim_id: str
    sim_time_sec: float
    aircraft_id: str
    callsign: str
    phase: str
    route_segment: str
    ground_speed_kt: float
    heading_deg: float
    altitude_ft: float
    vertical_speed_fpm: float
    distance_to_nearest_nm: float
    vertical_sep_to_nearest_ft: float
    num_instructions_last_30s: int
    time_since_last_instruction_sec: float
    last_instruction_type: str


class WoodWideClient:
    def __init__(self, api_key: str, base_url: str = "https://api.woodwide.ai", timeout_sec: float = 10.0):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout_sec = timeout_sec

    def _post(self, path: str, payload: Dict[str, Any]) -> Any:
        url = f"{self.base_url}{path}"
        data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(url, data=data, method="POST")
        request.add_header("Content-Type", "application/json")
        if self.api_key:
            request.add_header("Authorization", f"Bearer {self.api_key}")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_sec) as response:
                body = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            error_body = exc.read().decode("utf-8")
            raise RuntimeError(f"WoodWide HTTP {exc.code}: {error_body}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"WoodWide connection error: {exc.reason}") from exc
        if not body:
            return {}
        return json.loads(body)

    def run_anomaly_detection(self, model_id: str, rows: List[WoodWideRow]) -> Any:
        path = f"/models/anomaly/{model_id}/infer"
        payload: Dict[str, Any] = {"rows": rows}
        return self._post(path, payload)

    def run_prediction_inference(self, model_id: str, rows: List[WoodWideRow]) -> Any:
        path = f"/models/prediction/{model_id}/infer"
        payload: Dict[str, Any] = {"rows": rows}
        return self._post(path, payload)


class ActionScores(TypedDict, total=False):
    anomaly_score: Optional[float]
    risk_score: Optional[float]


class EvaluationResult(TypedDict):
    action: ActionName
    scores: ActionScores


def build_row_for_action(context: PlaneContext, action: ActionName) -> WoodWideRow:
    return WoodWideRow(
        sim_id=context.sim_id,
        sim_time_sec=context.sim_time_sec,
        aircraft_id=context.aircraft_id,
        callsign=context.callsign,
        phase=context.phase,
        route_segment=context.route_segment,
        ground_speed_kt=context.ground_speed_kt,
        heading_deg=context.heading_deg,
        altitude_ft=context.altitude_ft,
        vertical_speed_fpm=context.vertical_speed_fpm,
        distance_to_nearest_nm=context.distance_to_nearest_nm,
        vertical_sep_to_nearest_ft=context.vertical_sep_to_nearest_ft,
        num_instructions_last_30s=context.num_instructions_last_30s,
        time_since_last_instruction_sec=context.time_since_last_instruction_sec,
        last_instruction_type=context.last_instruction_type,
        action_name=action,
    )


def evaluate_actions_for_plane(
    client: WoodWideClient,
    context: PlaneContext,
    anomaly_model_id: Optional[str],
    prediction_model_id: Optional[str],
) -> Dict[ActionName, ActionScores]:
    actions: List[ActionName] = [
        "stay_pattern",
        "enter_tangent_hold_circle",
        "expedite_landing",
    ]
    rows: List[WoodWideRow] = [build_row_for_action(context, action) for action in actions]
    anomaly_output: Any = None
    prediction_output: Any = None
    if anomaly_model_id:
        anomaly_output = client.run_anomaly_detection(anomaly_model_id, rows)
    if prediction_model_id:
        prediction_output = client.run_prediction_inference(prediction_model_id, rows)
    result: Dict[ActionName, ActionScores] = {}
    for index, action in enumerate(actions):
        anomaly_score: Optional[float] = None
        risk_score: Optional[float] = None
        if isinstance(anomaly_output, dict):
            scores = anomaly_output.get("scores") or anomaly_output.get("rows")
            if isinstance(scores, list) and index < len(scores):
                value = scores[index]
                if isinstance(value, dict):
                    score_value = value.get("anomaly_score") or value.get("score")
                    if isinstance(score_value, (int, float)):
                        anomaly_score = float(score_value)
        if isinstance(prediction_output, dict):
            scores = prediction_output.get("scores") or prediction_output.get("rows")
            if isinstance(scores, list) and index < len(scores):
                value = scores[index]
                if isinstance(value, dict):
                    score_value = value.get("risk_score") or value.get("prediction")
                    if isinstance(score_value, (int, float)):
                        risk_score = float(score_value)
        result[action] = {"anomaly_score": anomaly_score, "risk_score": risk_score}
    return result


def choose_best_action(scores: Dict[ActionName, ActionScores]) -> ActionName:
    best_action: ActionName = "stay_pattern"
    best_value: float = float("inf")
    for action, action_scores in scores.items():
        anomaly_score = action_scores.get("anomaly_score")
        risk_score = action_scores.get("risk_score")
        candidates: List[float] = []
        if isinstance(anomaly_score, (int, float)):
            candidates.append(float(anomaly_score))
        if isinstance(risk_score, (int, float)):
            candidates.append(float(risk_score))
        if not candidates:
            continue
        value = max(candidates)
        if value < best_value:
            best_value = value
            best_action = action
    return best_action


def main() -> None:
    api_key = os.environ.get("WOODWIDE_API_KEY", "")
    anomaly_model_id = os.environ.get("WOODWIDE_ANOMALY_MODEL_ID")
    prediction_model_id = os.environ.get("WOODWIDE_PREDICTION_MODEL_ID")
    if not api_key:
        raise RuntimeError("WOODWIDE_API_KEY is not set")
    client = WoodWideClient(api_key=api_key)
    context = PlaneContext(
        sim_id="demo-sim",
        sim_time_sec=0.0,
        aircraft_id="ac-demo",
        callsign="DEMO123",
        phase="pattern",
        route_segment="pattern",
        ground_speed_kt=120.0,
        heading_deg=90.0,
        altitude_ft=2000.0,
        vertical_speed_fpm=0.0,
        distance_to_nearest_nm=3.0,
        vertical_sep_to_nearest_ft=1000.0,
        num_instructions_last_30s=0,
        time_since_last_instruction_sec=60.0,
        last_instruction_type="none",
    )
    scores = evaluate_actions_for_plane(client, context, anomaly_model_id, prediction_model_id)
    best_action = choose_best_action(scores)
    output: Dict[str, Any] = {
        "scores": scores,
        "best_action": best_action,
    }
    json.dump(output, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()

