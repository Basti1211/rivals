from typing import List, Tuple, Dict, Any, Union
from app.dataManager.fetchData.fetch_interaction_data import fetch_interaction_data
from app.types.responses.model_requests import InteractionRequest
from app.types.responses.analysis_responses import AnalysisRequest


def build_sessions_and_labels(request_body: Union[AnalysisRequest, dict], use_abstract: bool = True) -> Tuple[List[List[str]], List[bool], List[dict]]:
    """
    Call existing fetch_interaction_data to get cleaned interactions, then build
    sessions (list of action lists), labels (success bool per session) and a
    list of pair metadata dicts (user, task).
    """
    if isinstance(request_body, AnalysisRequest):
        interactions_list = request_body.interactions
    elif isinstance(request_body, dict):
        interactions_list = request_body.get("interactions", [])
    else:
        interactions_list = []

    interaction_request = InteractionRequest(interactions=interactions_list)
    response = fetch_interaction_data(interaction_request)

    def get_value(row: Any, key: str, default: Any = None) -> Any:
        if isinstance(row, dict):
            return row.get(key, default)
        if hasattr(row, "dict"):
            return getattr(row, key, default)
        return default

    # map task identifiers to task names when available
    task_id_to_name = {
        get_value(task, "task_id"): get_value(task, "name")
        for task in getattr(response.tasks, "tasks", [])
        if get_value(task, "task_id") is not None
    }

    # build submissions mapping to detect success per (user, task)
    submissions_by_pair: Dict[tuple, List[Any]] = {}
    for sub in response.submissions.submissions:
        task_key = get_value(sub, "task_id") or get_value(sub, "task_name")
        task_name = task_id_to_name.get(task_key, task_key)
        pair = (get_value(sub, "user"), task_name)
        submissions_by_pair.setdefault(pair, []).append(sub)

    sessions: List[List[str]] = []
    labels: List[bool] = []
    pairs_meta: List[dict] = []

    for item in response.interactions:
        user = get_value(item, "user")
        task = get_value(item, "task")
        interactions = get_value(item, "interactions", []) or []

        # choose field
        seq = []
        for it in interactions:
            abstract_type = get_value(it, "abstract_type")
            action = get_value(it, "action")
            seq.append(abstract_type if use_abstract and abstract_type is not None else action)

        if not user or not task or not seq:
            continue

        pair = (user, task)
        subs = submissions_by_pair.get(pair, [])
        success = any(get_value(s, "status") == 1 for s in subs)

        sessions.append(seq)
        labels.append(bool(success))
        pairs_meta.append({"user": user, "task": task})

    return sessions, labels, pairs_meta
