import type React from "react";
import {Button, Popover} from "antd";
import "./Information.css";

type InformationProps = {
  information: string;
};

const Information: React.FC<InformationProps> = ({information}) => (
  <Popover
    content={<p className="visualization-information-content">{information}</p>}
    placement="bottomRight"
    trigger="click"
  >
    <Button
      aria-label="Visualization information"
      className="visualization-information-button"
    >
      i
    </Button>
  </Popover>
);

export default Information;
