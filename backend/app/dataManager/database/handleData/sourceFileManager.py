from typing import Any

from app.dataManager.database.connection import fetch as db_fetch
from app.dataManager.database.connection import get_connection
from app.dataManager.database.connection import insert as db_insert
from app.dataManager.database.constants import SOURCE_FILE_DATA_TABLES


def insert(filename: str) -> int:
    """
    Insert a source filename and return its generated id.
    """

    return db_insert(
        """
        INSERT INTO SourceFiles (
            filename
        )
        VALUES (?);
        """,
        (filename,),
    )


def fetch_all() -> list[dict[str, Any]]:
    """
    Fetch all stored source files in insertion order.
    """

    return db_fetch(
        """
        SELECT id, filename
        FROM SourceFiles
        ORDER BY id;
        """
    )


def delete_with_data(source_file_id: int) -> None:
    """
    Delete a source file and every row that references it through from_file.
    """

    with get_connection() as conn:
        for table_name in SOURCE_FILE_DATA_TABLES:
            conn.execute(
                f"DELETE FROM {table_name} WHERE from_file = ?",
                (source_file_id,),
            )

        conn.execute(
            """
            DELETE FROM SourceFiles
            WHERE id = ?;
            """,
            (source_file_id,),
        )
