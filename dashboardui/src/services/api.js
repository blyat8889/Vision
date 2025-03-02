// src/services/api.js
import axios from 'axios';

const API_URL = 'http://127.0.0.1:5000/';  // Your Node.js backend URL


export const getSystemStatus = async () => {
    try {
        const response = await axios.get(`${API_URL}/api/status`);
        return response.data;
    } catch (error) {
        console.error('Error fetching system status:', error);
        throw error;
    }
};

export const getDetectionSettings = async () => {
    try {
        const response = await axios.get(`${API_URL}/api/detection/settings`);
        return response.data;
    } catch (error) {
        console.error('Error fetching detection settings:', error);
        throw error;
    }
};

export const getMouseSettings = async () => {
    try {
        const response = await axios.get(`${API_URL}/api/mouse/settings`);
        return response.data;
    } catch (error) {
        console.error('Error fetching mouse settings:', error);
        throw error;
    }
};

export const getDriverSettings = async () => {
    try {
        const response = await axios.get(`${API_URL}/api/driver/settings`);
        return response.data;
    } catch (error) {
        console.error('Error fetching driver settings:', error);
        throw error;
    }
};
// Add this to your api.js file
export const captureColorSample = async () => {
    try {
        const response = await axios.post(`${API_URL}/api/detection/sample`);
        return response.data;
    } catch (error) {
        console.error('Error sampling color:', error);
        throw error;
    }
};
export const startDetection = async () => {
    try {
        const response = await axios.post(`${API_URL}/api/detection/start`);
        return response.data;
    } catch (error) {
        console.error('Error starting detection:', error);
        throw error;
    }
};
export const updateDetectionSettings = async (settings) => {
    try {
        const response = await axios.post(`${API_URL}/api/detection/settings`, settings);
        return response.data;
    } catch (error) {
        console.error('Error updating detection settings:', error);
        throw error;
    }
};

export const stopDetection = async () => {
    try {
        const response = await axios.post(`${API_URL}/api/detection/stop`);
        return response.data;
    } catch (error) {
        console.error('Error stopping detection:', error);
        throw error;
    }
};
export const updateMouseSettings = async (settings) => {
    try {
        const response = await axios.post(`${API_URL}/api/mouse/settings`, settings);
        return response.data;
    } catch (error) {
        console.error('Error updating mouse settings:', error);
        throw error;
    }
};

export const updateDriverSettings = async (settings) => {
    try {
        const response = await axios.post(`${API_URL}/api/driver/settings`, settings);
        return response.data;
    } catch (error) {
        console.error('Error updating driver settings:', error);
        throw error;
    }
};

export const getPresets = async () => {
    try {
        const response = await axios.get(`${API_URL}/api/presets`);
        return response.data;
    } catch (error) {
        console.error('Error fetching presets:', error);
        throw error;
    }
};

export const applyPreset = async (presetId) => {
    try {
        const response = await axios.post(`${API_URL}/api/presets/${presetId}/apply`);
        return response.data;
    } catch (error) {
        console.error('Error applying preset:', error);
        throw error;
    }
};

export const getLogs = async (filters = {}) => {
    try {
        const queryParams = new URLSearchParams();

        if (filters.level) queryParams.append('level', filters.level);
        if (filters.module) queryParams.append('module', filters.module);
        if (filters.limit) queryParams.append('limit', filters.limit);

        const response = await axios.get(`${API_URL}/api/logs?${queryParams.toString()}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching logs:', error);
        throw error;
    }
};

export const clearLogs = async () => {
    try {
        const response = await axios.post(`${API_URL}/api/logs/clear`);
        return response.data;
    } catch (error) {
        console.error('Error clearing logs:', error);
        throw error;
    }
};