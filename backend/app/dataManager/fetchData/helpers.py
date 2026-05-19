from app.generic_helpers import from_json
import json
from app.types.responses.model_requests import InteractionHierarchyNode, InteractionRequest, SubmissionList, TaskList


def _unique(values: list) -> list:
    return list(dict.fromkeys(values))


def _placeholders(values: list[str]) -> str:
    return ", ".join("?" for _ in values)
    

def _leaf_to_abstract_type_map(hierarchy: list[InteractionHierarchyNode]) -> dict[str, str]:
    abstract_type_by_leaf = {}

    def visit(node: InteractionHierarchyNode, active_abstract_type: str | None) -> None:
        next_abstract_type = node.name if node.visualize else active_abstract_type

        if not node.children:
            abstract_type_by_leaf[node.name] = next_abstract_type or node.name
            return

        for child in node.children:
            visit(child, next_abstract_type)

    for node in hierarchy:
        visit(node, None)

    return abstract_type_by_leaf


def _cancelled_leaf_names(hierarchy: list[InteractionHierarchyNode]) -> list[str]:
    cancelled_leaf_names = []

    def visit(node: InteractionHierarchyNode, ancestor_cancelled: bool) -> None:
        is_cancelled = ancestor_cancelled or node.cancelled

        if not node.children:
            if is_cancelled:
                cancelled_leaf_names.append(node.name)
            return

        for child in node.children:
            visit(child, is_cancelled)

    for node in hierarchy:
        visit(node, False)

    return cancelled_leaf_names


def _time_window_condition(column_name: str, start_time: int | None, end_time: int | None) -> tuple[str, tuple]:
    conditions = []
    params = []

    if start_time is not None:
        conditions.append(f"{column_name} >= ?")
        params.append(start_time)

    if end_time is not None:
        conditions.append(f"{column_name} <= ?")
        params.append(end_time)

    if not conditions:
        return "1 = 0", ()

    return " AND ".join(conditions), tuple(params)

