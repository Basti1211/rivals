from typing import Any, Optional

from app.dataManager.database.connection import fetch as db_fetch


def _clean_sql_part(value: str, field_name: str) -> str:
    if not isinstance(value, str):
        raise TypeError(f"{field_name} must be a string")

    cleaned_value = value.strip()

    if not cleaned_value:
        raise ValueError(f"{field_name} cannot be empty")

    if ";" in cleaned_value:
        raise ValueError(f"{field_name} cannot contain semicolons")

    return cleaned_value


def _clean_sql_parts(values: list[str], field_name: str) -> list[str]:
    if not isinstance(values, list):
        raise TypeError(f"{field_name} must be a list of strings")

    return [
        _clean_sql_part(value, f"{field_name}[{index}]")
        for index, value in enumerate(values)
    ]


def build_fetch_query(
    Table_Name: str,
    Select: list[str],
    WHERE_conditions: list[str],
    EXTRA: str,
) -> str:
    """
    Build a SELECT query from table, column, WHERE-condition, and trailing SQL parts.
    """

    table_name = _clean_sql_part(Table_Name, "Table_Name")
    select_columns = _clean_sql_parts(Select, "Select")
    where_conditions = _clean_sql_parts(WHERE_conditions, "WHERE_conditions")

    if not isinstance(EXTRA, str):
        raise TypeError("EXTRA must be a string")

    extra = EXTRA.strip()

    if ";" in extra:
        raise ValueError("EXTRA cannot contain semicolons")

    select_clause = ", ".join(select_columns) if select_columns else "*"
    query = f"SELECT {select_clause} FROM {table_name}"

    if where_conditions:
        query += f" WHERE {' AND '.join(where_conditions)}"

    if extra:
        query += f" {extra}"

    return f"{query};"


def fetch(
    Table_Name: str,
    Select: list[str],
    WHERE_conditions: list[str],
    EXTRA: str,
    params: Optional[tuple[Any, ...]] = None,
) -> list[dict[str, Any]]:
    """
    Execute a SELECT query built from the four generic fetch arguments.
    """

    query = build_fetch_query(Table_Name, Select, WHERE_conditions, EXTRA)
    return db_fetch(query, params)
