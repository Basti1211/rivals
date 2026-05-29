import type React from "react";
import "./ExplanationVideo.css";

const ExplanationVideo: React.FC = () => {
    return (
        <div className="explanation-video">
            <div className="explanation-video__header">
                <h1>Explanation Video</h1>
            </div>
            <video
                className="explanation-video__player"
                controls
                preload="metadata"
                src="/explanation_video.mp4"
            >
                Your browser does not support the video tag.
            </video>
        </div>
    );
};

export default ExplanationVideo;
