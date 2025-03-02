import React from 'react';
import { Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Activity, Cpu, Clock, Zap } from 'react-feather';

const SystemStatus = ({ status }) => {
    // Default values if props not provided
    const {
        detectionActive = false,
        driverActive = false,
        mouseFilterActive = false,
        fps = 0,
        cpuUsage = 0,
        memoryUsage = 0,
        latency = 0
    } = status || {};

    // Helper function to determine status badge color
    const getBadgeColor = (isActive) => isActive ? 'success' : 'secondary';

    // Helper function to format latency with color
    const getLatencyColor = (latencyMs) => {
        if (latencyMs < 10) return 'success';
        if (latencyMs < 20) return 'warning';
        return 'danger';
    };

    return (
        <div className="system-status d-flex align-items-center">
            {/* Component Status Badges */}
            <div className="status-badges mr-4">
                <OverlayTrigger
                    placement="bottom"
                    overlay={<Tooltip>Detection Module: {detectionActive ? 'Active' : 'Inactive'}</Tooltip>}
                >
                    <Badge
                        variant={getBadgeColor(detectionActive)}
                        className="mr-1"
                        style={{ cursor: 'help' }}
                    >
                        Detection
                    </Badge>
                </OverlayTrigger>

                <OverlayTrigger
                    placement="bottom"
                    overlay={<Tooltip>Mouse Filter: {mouseFilterActive ? 'Active' : 'Inactive'}</Tooltip>}
                >
                    <Badge
                        variant={getBadgeColor(mouseFilterActive)}
                        className="mr-1"
                        style={{ cursor: 'help' }}
                    >
                        Mouse Filter
                    </Badge>
                </OverlayTrigger>

                <OverlayTrigger
                    placement="bottom"
                    overlay={<Tooltip>HID Driver: {driverActive ? 'Active' : 'Inactive'}</Tooltip>}
                >
                    <Badge
                        variant={getBadgeColor(driverActive)}
                        className="mr-1"
                        style={{ cursor: 'help' }}
                    >
                        Driver
                    </Badge>
                </OverlayTrigger>
            </div>

            {/* Performance Metrics */}
            <div className="performance-metrics d-flex">
                <OverlayTrigger
                    placement="bottom"
                    overlay={<Tooltip>CPU Usage</Tooltip>}
                >
                    <div className="metric mr-3 d-flex align-items-center">
                        <Cpu size={16} className="mr-1" />
                        <span>{cpuUsage.toFixed(1)}%</span>
                    </div>
                </OverlayTrigger>

                <OverlayTrigger
                    placement="bottom"
                    overlay={<Tooltip>Memory Usage</Tooltip>}
                >
                    <div className="metric mr-3 d-flex align-items-center">
                        <Activity size={16} className="mr-1" />
                        <span>{memoryUsage.toFixed(1)}%</span>
                    </div>
                </OverlayTrigger>

                <OverlayTrigger
                    placement="bottom"
                    overlay={<Tooltip>Frames Per Second</Tooltip>}
                >
                    <div className="metric mr-3 d-flex align-items-center">
                        <Clock size={16} className="mr-1" />
                        <span>{fps} FPS</span>
                    </div>
                </OverlayTrigger>

                <OverlayTrigger
                    placement="bottom"
                    overlay={<Tooltip>Processing Latency</Tooltip>}
                >
                    <div className="metric d-flex align-items-center">
                        <Zap size={16} className="mr-1" />
                        <span className={`text-${getLatencyColor(latency)}`}>
                            {latency.toFixed(1)} ms
                        </span>
                    </div>
                </OverlayTrigger>
            </div>
        </div>
    );
};

export default SystemStatus;