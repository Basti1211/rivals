import type React from "react";
import {Button, Dropdown} from "antd";
import type {MenuProps} from "antd";
import type {
  FetchInteractionDataResponse,
  InteractionHierarchyNode,
} from "../../../../../types/dataTypes";
import {useLayout} from "../../../flex-layout-context/LayoutManagerContext";

type VisualizationComponentType = "countBarchart" | "durationBarchart" | "searchLines" | "searchLines2";

type VisualizationSnapshotMenuProps = {
  currentData: FetchInteractionDataResponse | null;
  sourceVisualizationId?: string;
  sourceVisualizationType: VisualizationComponentType;
};

type VisualizationSnapshotConfig = {
  initialData: FetchInteractionDataResponse | null;
  sourceVisualizationId?: string;
  sourceVisualizationType: VisualizationComponentType;
};

const visualizationTargets: Array<{
  component: VisualizationComponentType;
  name: string;
  allowCancel: boolean;
}> = [
  {component: "countBarchart", name: "Count Barchart", allowCancel: true},
  {component: "durationBarchart", name: "Duration Barchart", allowCancel: false},
  {component: "searchLines2", name: "Search Lines", allowCancel: true},
];

const cloneInteractionData = (
  data: FetchInteractionDataResponse | null,
): FetchInteractionDataResponse | null => {
  return data ? structuredClone(data) : null;
};

const selectTopLevelHierarchy = (
  hierarchy: InteractionHierarchyNode[],
): InteractionHierarchyNode[] => {
  const normalizeChildren = (nodes: InteractionHierarchyNode[]): InteractionHierarchyNode[] =>
    nodes.map((node) => ({
      ...node,
      Visualize: false,
      Cancelled: false,
      Children: normalizeChildren(node.Children ?? []),
    }));

  return hierarchy.map((node) => ({
    ...node,
    Visualize: true,
    Cancelled: false,
    Children: normalizeChildren(node.Children ?? []),
  }));
};

const getAbstractTypeByAction = (
  hierarchy: InteractionHierarchyNode[],
): Map<string, string> => {
  const abstractTypeByAction = new Map<string, string>();

  const visit = (node: InteractionHierarchyNode, activeAbstractType: string | null): void => {
    const nextAbstractType = node.Visualize ? node.Name : activeAbstractType;
    abstractTypeByAction.set(node.Name, nextAbstractType ?? node.Name);

    (node.Children ?? []).forEach((child) => {
      visit(child, nextAbstractType);
    });
  };

  hierarchy.forEach((node) => {
    visit(node, null);
  });

  return abstractTypeByAction;
};

const selectAllInteractions = (
  data: FetchInteractionDataResponse,
): FetchInteractionDataResponse => ({
  ...data,
  submissions: {
    ...data.submissions,
    submissions: data.submissions.submissions.map((submission) => ({
      ...submission,
      selected: true,
    })),
  },
  interactions: data.interactions.map((interactionGroup) => ({
    ...interactionGroup,
    interactions: interactionGroup.interactions.map((interaction) => ({
      ...interaction,
      selected: true,
    })),
  })),
});

const normalizeSnapshotForTarget = (
  data: FetchInteractionDataResponse | null,
  target: {component: VisualizationComponentType; allowCancel: boolean},
): FetchInteractionDataResponse | null => {
  let snapshot = cloneInteractionData(data);

  if (!snapshot) {
    return snapshot;
  }

  if (target.component === "searchLines" || target.component === "searchLines2") {
    snapshot = selectAllInteractions(snapshot);
  }

  if (target.allowCancel) {
    return snapshot;
  }

  const abstractTypeByUser = new Map(
    snapshot.users.users.map((user) => {
      user.hierarchy = selectTopLevelHierarchy(user.hierarchy);

      return [user.user, getAbstractTypeByAction(user.hierarchy)];
    }),
  );

  snapshot.interactions = snapshot.interactions.map((interactionGroup) => {
    const abstractTypeByAction = abstractTypeByUser.get(interactionGroup.user);

    return {
      ...interactionGroup,
      interactions: interactionGroup.interactions.map((interaction) => ({
        ...interaction,
        abstract_type: abstractTypeByAction?.get(interaction.action) ?? interaction.action,
        cancelled: false,
      })),
    };
  });

  return snapshot;
};

const VisualizationSnapshotMenu: React.FC<VisualizationSnapshotMenuProps> = ({
  currentData,
  sourceVisualizationId,
  sourceVisualizationType,
}) => {
  const {addTabToActiveTabSet} = useLayout();
  const hasData = currentData !== null;

  const items: MenuProps["items"] = visualizationTargets.map((target) => ({
    key: target.component,
    label: target.name,
  }));

  const handleOpenAs: MenuProps["onClick"] = ({key}) => {
    if (!hasData) {
      return;
    }

    const target = visualizationTargets.find((candidate) => candidate.component === key);

    if (!target) {
      return;
    }

    const config: VisualizationSnapshotConfig = {
      initialData: normalizeSnapshotForTarget(currentData, target),
      sourceVisualizationId,
      sourceVisualizationType,
    };

    addTabToActiveTabSet(target.name, target.component, config);
  };

  return (
    <Dropdown
      menu={{items, onClick: handleOpenAs}}
      trigger={["click"]}
      disabled={!hasData}
    >
      <Button disabled={!hasData}>
        Open as
      </Button>
    </Dropdown>
  );
};

export default VisualizationSnapshotMenu;
