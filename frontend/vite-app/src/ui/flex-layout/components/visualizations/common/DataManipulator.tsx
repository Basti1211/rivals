import {useEffect, useMemo, useState} from "react";
import type React from "react";
import {Alert, Button} from "antd";
import type {
  FetchInteractionDataResponse,
  FetchUsersAndTasks,
  InteractionHierarchyNode,
  InteractionRequestRow,
  TaskRow,
  UserRow,
} from "../../../../../types/dataTypes";
import HierarchySelector, {
  applyHierarchySelection,
  getCancelledHierarchySelection,
  getVisualizedHierarchySelection,
} from "./HierarchySelector";
import "./DataManipulator.css";

type DataManipulatorHierarchyOptions = {
  allowCancel?: boolean;
};

type DataManipulatorProps = {
  displayedData: FetchInteractionDataResponse | null;
  availableData?: FetchUsersAndTasks | null;
  isLoadingAvailableData?: boolean;
  errorMessage?: string | null;
  isUpdatingData?: boolean;
  hierarchyOptions?: DataManipulatorHierarchyOptions;
  onUpdateData: (interactions: InteractionRequestRow[]) => Promise<void> | void;
  onClose?: () => void;
};

type HierarchyEditorTarget =
  | {type: "user"; user: string}
  | {type: "system"; system: string};

type TaskGroup = {
  name: string;
  tasks: TaskRow[];
};

const MISSING_TASK_GROUP_LABEL = "Unknown task group";

const selectionKey = (user: string, task: string): string => JSON.stringify([user, task]);

const selectedKeysFromData = (
  displayedData: FetchInteractionDataResponse | null,
): Set<string> => {
  return new Set(
    displayedData?.interactions.map(({user, task}) => selectionKey(user, task)) ?? [],
  );
};

const getSystemGroups = (users: UserRow[]): Map<string, UserRow[]> => {
  const groups = new Map<string, UserRow[]>();

  users.forEach((user) => {
    const systemUsers = groups.get(user.system) ?? [];
    systemUsers.push(user);
    groups.set(user.system, systemUsers);
  });

  return groups;
};

const getTaskGroups = (tasks: TaskRow[]): TaskGroup[] => {
  const groups = new Map<string, TaskRow[]>();

  tasks.forEach((task) => {
    const groupName = task.taskGroup || MISSING_TASK_GROUP_LABEL;
    const groupTasks = groups.get(groupName) ?? [];
    groupTasks.push(task);
    groups.set(groupName, groupTasks);
  });

  return Array.from(groups.entries()).map(([name, groupTasks]) => ({
    name,
    tasks: groupTasks,
  }));
};

const getPairKeys = (users: UserRow[], tasks: TaskRow[]): string[] => {
  return users.flatMap((user) =>
    tasks.map((task) => selectionKey(user.user, task.name)),
  );
};

const hasEveryKey = (selectedKeys: Set<string>, keys: string[]): boolean => {
  return keys.length > 0 && keys.every((key) => selectedKeys.has(key));
};

const cloneHierarchy = (
  hierarchy: InteractionHierarchyNode[],
): InteractionHierarchyNode[] => {
  return structuredClone(hierarchy);
};

const getInitialHierarchySelections = (
  users: UserRow[],
): Record<string, string[]> => {
  return Object.fromEntries(
    users.map((user) => [
      user.user,
      getVisualizedHierarchySelection(user.hierarchy),
    ]),
  );
};

const getInitialCancelledHierarchySelections = (
  users: UserRow[],
): Record<string, string[]> => {
  return Object.fromEntries(
    users.map((user) => [
      user.user,
      getCancelledHierarchySelection(user.hierarchy),
    ]),
  );
};

const DataManipulator: React.FC<DataManipulatorProps> = ({
  displayedData,
  availableData = null,
  isLoadingAvailableData = false,
  errorMessage = null,
  isUpdatingData = false,
  hierarchyOptions,
  onUpdateData,
  onClose,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() =>
    selectedKeysFromData(displayedData),
  );
  const [selectedHierarchyNamesByUser, setSelectedHierarchyNamesByUser] = useState<Record<string, string[]>>({});
  const [cancelledHierarchyNamesByUser, setCancelledHierarchyNamesByUser] = useState<Record<string, string[]>>({});
  const [hierarchyEditorTarget, setHierarchyEditorTarget] = useState<HierarchyEditorTarget | null>(null);

  useEffect(() => {
    setSelectedKeys(selectedKeysFromData(displayedData));
  }, [displayedData]);

  const rawUsers = useMemo(() => availableData?.users.users ?? [], [availableData]);
  const users = useMemo(() => {
    const displayedUsersByName = new Map(
      displayedData?.users.users.map((user) => [user.user, user]) ?? [],
    );

    return rawUsers.map((user) => ({
      ...user,
      hierarchy: displayedUsersByName.get(user.user)?.hierarchy ?? user.hierarchy,
    }));
  }, [displayedData, rawUsers]);
  const tasks = useMemo(() => availableData?.tasks.tasks ?? [], [availableData]);
  const allKeys = useMemo(() => getPairKeys(users, tasks), [users, tasks]);
  const systemGroups = useMemo(() => getSystemGroups(users), [users]);
  const taskGroups = useMemo(() => getTaskGroups(tasks), [tasks]);
  const selectedCount = selectedKeys.size;
  const allowHierarchyCancel = hierarchyOptions?.allowCancel ?? false;

  useEffect(() => {
    setSelectedHierarchyNamesByUser((currentSelections) => {
      const initialSelections = getInitialHierarchySelections(users);

      return Object.fromEntries(
        users.map((user) => [
          user.user,
          currentSelections[user.user] ?? initialSelections[user.user],
        ]),
      );
    });
    setCancelledHierarchyNamesByUser((currentSelections) => {
      const initialSelections = getInitialCancelledHierarchySelections(users);

      return Object.fromEntries(
        users.map((user) => [
          user.user,
          currentSelections[user.user] ?? initialSelections[user.user],
        ]),
      );
    });
  }, [users]);

  const setKeysSelected = (keys: string[], selected: boolean): void => {
    setSelectedKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      keys.forEach((key) => {
        if (selected) {
          nextKeys.add(key);
        } else {
          nextKeys.delete(key);
        }
      });

      return nextKeys;
    });
  };

  const toggleScope = (keys: string[]): void => {
    setKeysSelected(keys, !hasEveryKey(selectedKeys, keys));
  };

  const handleCellChange = (user: string, task: string, checked: boolean): void => {
    setKeysSelected([selectionKey(user, task)], checked);
  };

  const handleUpdate = async (): Promise<void> => {
    const selectedInteractions = users.flatMap((user) =>
      tasks
        .filter((task) => selectedKeys.has(selectionKey(user.user, task.name)))
        .map((task) => ({
          user: user.user,
          task: task.name,
          hierarchy: applyHierarchySelection(
            cloneHierarchy(user.hierarchy),
            selectedHierarchyNamesByUser[user.user] ?? getVisualizedHierarchySelection(user.hierarchy),
            allowHierarchyCancel
              ? cancelledHierarchyNamesByUser[user.user] ?? getCancelledHierarchySelection(user.hierarchy)
              : [],
          ),
        })),
    );

    await onUpdateData(selectedInteractions);
  };

  const isUserSelected = (user: UserRow): boolean => {
    return hasEveryKey(selectedKeys, getPairKeys([user], tasks));
  };

  const isTaskSelected = (task: TaskRow): boolean => {
    return hasEveryKey(selectedKeys, getPairKeys(users, [task]));
  };

  const isTaskGroupSelected = (taskGroup: TaskGroup): boolean => {
    return hasEveryKey(selectedKeys, getPairKeys(users, taskGroup.tasks));
  };

  const isSystemSelected = (systemUsers: UserRow[]): boolean => {
    return hasEveryKey(selectedKeys, getPairKeys(systemUsers, tasks));
  };

  const getHierarchyEditorData = (): {
    title: string;
    hierarchy: InteractionHierarchyNode[];
    selectedNodeNames: string[];
    cancelledNodeNames: string[];
  } | null => {
    if (!hierarchyEditorTarget) {
      return null;
    }

    if (hierarchyEditorTarget.type === "user") {
      const user = users.find((candidate) => candidate.user === hierarchyEditorTarget.user);

      if (!user) {
        return null;
      }

      return {
        title: `Hierarchy: ${user.user}`,
        hierarchy: user.hierarchy,
        selectedNodeNames: selectedHierarchyNamesByUser[user.user] ?? getVisualizedHierarchySelection(user.hierarchy),
        cancelledNodeNames: allowHierarchyCancel
          ? cancelledHierarchyNamesByUser[user.user] ?? getCancelledHierarchySelection(user.hierarchy)
          : [],
      };
    }

    const systemUsers = systemGroups.get(hierarchyEditorTarget.system) ?? [];
    const referenceUser = systemUsers[0];

    if (!referenceUser) {
      return null;
    }

    return {
      title: `Hierarchy: ${hierarchyEditorTarget.system}`,
      hierarchy: referenceUser.hierarchy,
      selectedNodeNames: selectedHierarchyNamesByUser[referenceUser.user] ?? getVisualizedHierarchySelection(referenceUser.hierarchy),
      cancelledNodeNames: allowHierarchyCancel
        ? cancelledHierarchyNamesByUser[referenceUser.user] ?? getCancelledHierarchySelection(referenceUser.hierarchy)
        : [],
    };
  };

  const handleHierarchyApply = (
    _updatedHierarchy: InteractionHierarchyNode[],
    selectedNodeNames: string[],
    cancelledNodeNames: string[],
  ): void => {
    if (!hierarchyEditorTarget) {
      return;
    }

    setSelectedHierarchyNamesByUser((currentSelections) => {
      const nextSelections = {...currentSelections};

      if (hierarchyEditorTarget.type === "user") {
        nextSelections[hierarchyEditorTarget.user] = selectedNodeNames;
      } else {
        const systemUsers = systemGroups.get(hierarchyEditorTarget.system) ?? [];
        systemUsers.forEach((user) => {
          nextSelections[user.user] = selectedNodeNames;
        });
      }

      return nextSelections;
    });
    setCancelledHierarchyNamesByUser((currentSelections) => {
      const nextSelections = {...currentSelections};

      if (hierarchyEditorTarget.type === "user") {
        nextSelections[hierarchyEditorTarget.user] = allowHierarchyCancel ? cancelledNodeNames : [];
      } else {
        const systemUsers = systemGroups.get(hierarchyEditorTarget.system) ?? [];
        systemUsers.forEach((user) => {
          nextSelections[user.user] = allowHierarchyCancel ? cancelledNodeNames : [];
        });
      }

      return nextSelections;
    });
    setHierarchyEditorTarget(null);
  };

  const hierarchyEditorData = getHierarchyEditorData();

  return (
    <div className="data-manipulator">
      <div className="data-manipulator-toolbar">
        <div>
          <h2>Available Users - Tasks</h2>
          <div className="data-manipulator-meta">
            {selectedCount} selected
          </div>
        </div>

        <div className="data-manipulator-actions">
          <Button onClick={() => setKeysSelected(allKeys, true)} disabled={!allKeys.length}>
            All data
          </Button>
          <Button onClick={() => setSelectedKeys(new Set())} disabled={!selectedCount}>
            Clear
          </Button>
          <Button
            type="primary"
            loading={isUpdatingData}
            onClick={() => void handleUpdate()}
          >
            Update Data
          </Button>
          {onClose && (
            <Button onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {errorMessage && (
        <Alert
          className="data-manipulator-alert"
          type="error"
          showIcon
          message={errorMessage}
        />
      )}

      {isLoadingAvailableData ? (
        <div className="data-manipulator-empty">Loading...</div>
      ) : availableData && users.length && tasks.length ? (
        <>
          <div className="data-manipulator-system-row">
            {Array.from(systemGroups.entries()).map(([system, systemUsers]) => (
              <div className="data-manipulator-scope-group" key={system}>
                <Button
                  type={isSystemSelected(systemUsers) ? "primary" : "default"}
                  onClick={() => toggleScope(getPairKeys(systemUsers, tasks))}
                >
                  {system}
                </Button>
                <Button
                  className="data-manipulator-hierarchy-button"
                  aria-label={`Open hierarchy for ${system}`}
                  onClick={() => setHierarchyEditorTarget({type: "system", system})}
                >
                  H
                </Button>
              </div>
            ))}
          </div>

          <div className="data-manipulator-task-group-row">
            {taskGroups.map((taskGroup) => (
              <Button
                key={taskGroup.name}
                type={isTaskGroupSelected(taskGroup) ? "primary" : "default"}
                onClick={() => toggleScope(getPairKeys(users, taskGroup.tasks))}
              >
                {taskGroup.name} ({taskGroup.tasks.length})
              </Button>
            ))}
          </div>

          {hierarchyEditorData && (
            <HierarchySelector
              title={hierarchyEditorData.title}
              hierarchy={hierarchyEditorData.hierarchy}
              selectedNodeNames={hierarchyEditorData.selectedNodeNames}
              cancelledNodeNames={hierarchyEditorData.cancelledNodeNames}
              allowCancel={allowHierarchyCancel}
              onApply={handleHierarchyApply}
              onClose={() => setHierarchyEditorTarget(null)}
            />
          )}

          <div className="data-manipulator-matrix-wrap">
            <table className="data-manipulator-matrix">
              <thead>
                <tr>
                  <th className="data-manipulator-corner">User</th>
                  {tasks.map((task) => (
                    <th key={task.name}>
                      <Button
                        className="data-manipulator-task-button"
                        type={isTaskSelected(task) ? "primary" : "default"}
                        onClick={() => toggleScope(getPairKeys(users, [task]))}
                      >
                        {task.name}
                      </Button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.user}>
                    <th>
                      <div className="data-manipulator-user-controls">
                        <Button
                          className="data-manipulator-user-button"
                          type={isUserSelected(user) ? "primary" : "default"}
                          onClick={() => toggleScope(getPairKeys([user], tasks))}
                        >
                          {user.user}
                        </Button>
                        <Button
                          className="data-manipulator-hierarchy-button"
                          aria-label={`Open hierarchy for ${user.user}`}
                          onClick={() => setHierarchyEditorTarget({type: "user", user: user.user})}
                        >
                          H
                        </Button>
                      </div>
                      <span>{user.system}</span>
                    </th>
                    {tasks.map((task) => {
                      const key = selectionKey(user.user, task.name);

                      const isSelected = selectedKeys.has(key);

                      return (
                        <td key={key}>
                          <button
                            type="button"
                            className={[
                              "data-manipulator-cell-toggle",
                              isSelected ? "is-selected" : "",
                            ].join(" ")}
                            aria-pressed={isSelected}
                            aria-label={`${user.user} ${task.name}`}
                            onClick={() => handleCellChange(user.user, task.name, !isSelected)}
                          >
                            {isSelected ? "On" : "Off"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="data-manipulator-empty">No available data</div>
      )}
    </div>
  );
};

export default DataManipulator;
