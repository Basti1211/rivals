from typing import Any, Optional

from app.dataManager.database.connection import insert as db_insert
from app.dataManager.database.connection import insert_many as db_insert_many
from app.generic_helpers import to_json
from app.types.responses.model_requests import InteractionLogList


def insert(interaction_log_list: InteractionLogList, from_file: int | None = None) -> int:
    """
    Insert users and their interaction logs.

    Users are inserted once per logging system if they do not exist yet.
    Returns the number of inserted interaction rows.
    """

    insert_user_sql = """
        INSERT OR IGNORE INTO Users (
            user_name,
            system_name,
            hierarchy,
            from_file
        )
        VALUES (?, ?, ?, ?);
    """

    insert_interaction_sql = """
        INSERT INTO Interactions (
            user_name,
            time,
            type,
            frame_rank,
            video_rank,
            metadata,
            from_file
        )
        VALUES (?, ?, ?, ?, ?, ?, ?);
    """

    inserted_count = 0

    for system in interaction_log_list.interaction_logs:
        hierarchy = to_json(
            [
                hierarchy_node.model_dump(by_alias=True)
                for hierarchy_node in system.hierarchy
            ]
        )

        for user_name, logs in system.logs.items():
            db_insert(
                insert_user_sql,
                (
                    user_name,
                    system.name,
                    hierarchy,
                    from_file,
                ),
            )

            interaction_rows = [
                (
                    user_name,
                    int(log.timestamp),
                    log.action,
                    _rank_to_int(log.frame_rank),
                    _rank_to_int(log.video_rank),
                    _metadata_to_text(log.metadata),
                    from_file,
                )
                for log in logs
            ]

            if interaction_rows:
                db_insert_many(insert_interaction_sql, interaction_rows)
                inserted_count += len(interaction_rows)

    return inserted_count


def _rank_to_int(rank: Optional[float]) -> Optional[int]:
    if rank is None:
        return None

    return int(rank)


def _metadata_to_text(metadata: Optional[Any]) -> Optional[str]:
    if metadata is None:
        return None

    if isinstance(metadata, str):
        return metadata

    return to_json(metadata)
