import json
from typing import Any, Optional
def to_json(value: Any) -> str:
    """
    Convert a Python object to JSON text.
    """

    return json.dumps(value)


def from_json(value: Optional[str]) -> Any:
    """
    Convert JSON text from SQLite back to a Python object.
    """

    if value is None:
        return None

    return json.loads(value)