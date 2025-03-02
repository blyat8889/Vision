/*
 * HID Filter Driver for Input Adjustment System
 *
 * This driver acts as a filter for mouse input devices, intercepting and optionally
 * modifying input data before it reaches the operating system. It allows for dynamic
 * adjustment of mouse movement, enabling the computer vision system to enhance precision.
 *
 * Educational and Research Purposes Only
 */

#include <ntddk.h>
#include <wdf.h>
#include <hidport.h>

 // WPP Tracing
#define WPP_CONTROL_GUIDS \
    WPP_DEFINE_CONTROL_GUID(HidFilterDriverTraceGuid, \
        (4A1E37F5, 8FC2, 4E35, 9C07, 1F423CF43DB8), \
        WPP_DEFINE_BIT(TRACE_DRIVER) \
        WPP_DEFINE_BIT(TRACE_DEVICE) \
        WPP_DEFINE_BIT(TRACE_QUEUE) \
        WPP_DEFINE_BIT(TRACE_FILTER))

#include "trace.h"

// Driver and device context structures
typedef struct _FILTER_EXTENSION
{
    WDFDEVICE Device;
    WDFQUEUE Queue;
    WDFQUEUE PendingQueue;
    WDFIOTARGET Target;

    // Input adjustment parameters
    BOOLEAN FilterActive;
    LONG SmoothingFactor;        // 0-100, higher values = more smoothing
    LONG ResponseSpeed;          // 0-100, higher values = faster response
    LONG FilteringStrength;      // 0-100, higher values = stronger filtering

    // Recent mouse positions for filtering algorithms
    LONG LastXPosition;
    LONG LastYPosition;
    LONG LastXOutput;
    LONG LastYOutput;

    // Circular buffer for more advanced filters
#define HISTORY_SIZE 10
    LONG XHistory[HISTORY_SIZE];
    LONG YHistory[HISTORY_SIZE];
    ULONG HistoryIndex;

    // Flags
    BOOLEAN HistoryInitialized;

} FILTER_EXTENSION, * PFILTER_EXTENSION;

WDF_DECLARE_CONTEXT_TYPE_WITH_NAME(FILTER_EXTENSION, FilterGetData)

// Forward declarations
DRIVER_INITIALIZE DriverEntry;
EVT_WDF_DRIVER_DEVICE_ADD HidFilterDriverDeviceAdd;
EVT_WDF_IO_QUEUE_IO_DEVICE_CONTROL HidFilterDriverIoDeviceControl;
EVT_WDF_IO_QUEUE_IO_INTERNAL_DEVICE_CONTROL HidFilterDriverIoInternalDeviceControl;
EVT_WDF_IO_QUEUE_IO_DEFAULT HidFilterQueueDefault;
EVT_WDF_DEVICE_PREPARE_HARDWARE HidFilterDriverPrepareHardware;
EVT_WDF_DEVICE_RELEASE_HARDWARE HidFilterDriverReleaseHardware;

// Custom IOCTLs for controlling driver behavior
#define IOCTL_HIDFILTER_SET_ACTIVE \
    CTL_CODE(FILE_DEVICE_UNKNOWN, 0x800, METHOD_BUFFERED, FILE_WRITE_ACCESS)

#define IOCTL_HIDFILTER_SET_SMOOTHING \
    CTL_CODE(FILE_DEVICE_UNKNOWN, 0x801, METHOD_BUFFERED, FILE_WRITE_ACCESS)

#define IOCTL_HIDFILTER_SET_RESPONSE \
    CTL_CODE(FILE_DEVICE_UNKNOWN, 0x802, METHOD_BUFFERED, FILE_WRITE_ACCESS)

#define IOCTL_HIDFILTER_SET_FILTERING \
    CTL_CODE(FILE_DEVICE_UNKNOWN, 0x803, METHOD_BUFFERED, FILE_WRITE_ACCESS)

#define IOCTL_HIDFILTER_GET_PARAMETERS \
    CTL_CODE(FILE_DEVICE_UNKNOWN, 0x804, METHOD_BUFFERED, FILE_READ_ACCESS)

// Filter input data structure
typedef struct _HIDFILTER_PARAMETERS
{
    BOOLEAN FilterActive;
    LONG SmoothingFactor;
    LONG ResponseSpeed;
    LONG FilteringStrength;
} HIDFILTER_PARAMETERS, * PHIDFILTER_PARAMETERS;

// Mouse report structure as defined by HID standard
#pragma pack(push, 1)
typedef struct _MOUSE_REPORT
{
    UCHAR Buttons;
    CHAR X;
    CHAR Y;
    CHAR Wheel;
} MOUSE_REPORT, * PMOUSE_REPORT;
#pragma pack(pop)

// Function to process mouse input
VOID ProcessMouseInput(
    _Inout_ PMOUSE_REPORT Report,
    _Inout_ PFILTER_EXTENSION FilterExt
);

// Filter Algorithm Functions
VOID ApplyExponentialSmoothing(PFILTER_EXTENSION FilterExt, PCHAR X, PCHAR Y);
VOID ApplyMovingAverage(PFILTER_EXTENSION FilterExt, PCHAR X, PCHAR Y);
VOID ApplyAdaptiveFiltering(PFILTER_EXTENSION FilterExt, PCHAR X, PCHAR Y);

// Driver entry point
NTSTATUS
DriverEntry(
    _In_ PDRIVER_OBJECT DriverObject,
    _In_ PUNICODE_STRING RegistryPath
)
{
    NTSTATUS status;
    WDF_DRIVER_CONFIG config;

    // Initialize WPP Tracing
    WPP_INIT_TRACING(DriverObject, RegistryPath);

    TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_DRIVER, "%!FUNC! Entry");

    // Initialize driver configuration
    WDF_DRIVER_CONFIG_INIT(&config, HidFilterDriverDeviceAdd);

    // Create the driver object
    status = WdfDriverCreate(
        DriverObject,
        RegistryPath,
        WDF_NO_OBJECT_ATTRIBUTES,
        &config,
        WDF_NO_HANDLE
    );

    if (!NT_SUCCESS(status)) {
        TraceEvents(TRACE_LEVEL_ERROR, TRACE_DRIVER,
            "WdfDriverCreate failed: %!STATUS!", status);
        WPP_CLEANUP(DriverObject);
        return status;
    }

    TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_DRIVER, "%!FUNC! Exit");

    return status;
}

// Add device callback
NTSTATUS
HidFilterDriverDeviceAdd(
    _In_ WDFDRIVER Driver,
    _Inout_ PWDFDEVICE_INIT DeviceInit
)
{
    NTSTATUS status;
    WDFDEVICE device;
    PFILTER_EXTENSION filterExt;
    WDF_OBJECT_ATTRIBUTES deviceAttributes;
    WDF_IO_QUEUE_CONFIG queueConfig;
    WDFQUEUE queue;
    WDF_PNPPOWER_EVENT_CALLBACKS pnpPowerCallbacks;

    UNREFERENCED_PARAMETER(Driver);

    TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_DEVICE, "%!FUNC! Entry");

    // Set up PnP and power callbacks
    WDF_PNPPOWER_EVENT_CALLBACKS_INIT(&pnpPowerCallbacks);
    pnpPowerCallbacks.EvtDevicePrepareHardware = HidFilterDriverPrepareHardware;
    pnpPowerCallbacks.EvtDeviceReleaseHardware = HidFilterDriverReleaseHardware;
    WdfDeviceInitSetPnpPowerEventCallbacks(DeviceInit, &pnpPowerCallbacks);

    // Set device context configuration
    WDF_OBJECT_ATTRIBUTES_INIT_CONTEXT_TYPE(&deviceAttributes, FILTER_EXTENSION);

    // Create the device
    status = WdfDeviceCreate(&DeviceInit, &deviceAttributes, &device);
    if (!NT_SUCCESS(status)) {
        TraceEvents(TRACE_LEVEL_ERROR, TRACE_DEVICE,
            "WdfDeviceCreate failed: %!STATUS!", status);
        return status;
    }

    // Get the device context
    filterExt = FilterGetData(device);
    filterExt->Device = device;

    // Initialize filter parameters with defaults
    filterExt->FilterActive = FALSE;
    filterExt->SmoothingFactor = 50;     // Mid-range default
    filterExt->ResponseSpeed = 50;        // Mid-range default
    filterExt->FilteringStrength = 50;    // Mid-range default
    filterExt->HistoryInitialized = FALSE;
    filterExt->HistoryIndex = 0;

    // Set up default queue for device controls
    WDF_IO_QUEUE_CONFIG_INIT_DEFAULT_QUEUE(&queueConfig, WdfIoQueueDispatchSequential);
    queueConfig.EvtIoDeviceControl = HidFilterDriverIoDeviceControl;
    queueConfig.EvtIoInternalDeviceControl = HidFilterDriverIoInternalDeviceControl;
    queueConfig.EvtIoDefault = HidFilterQueueDefault;

    status = WdfIoQueueCreate(
        device,
        &queueConfig,
        WDF_NO_OBJECT_ATTRIBUTES,
        &queue
    );

    if (!NT_SUCCESS(status)) {
        TraceEvents(TRACE_LEVEL_ERROR, TRACE_DEVICE,
            "WdfIoQueueCreate failed: %!STATUS!", status);
        return status;
    }

    filterExt->Queue = queue;

    // Create a pending queue for requests that need special handling
    WDF_IO_QUEUE_CONFIG_INIT(&queueConfig, WdfIoQueueDispatchManual);

    status = WdfIoQueueCreate(
        device,
        &queueConfig,
        WDF_NO_OBJECT_ATTRIBUTES,
        &filterExt->PendingQueue
    );

    if (!NT_SUCCESS(status)) {
        TraceEvents(TRACE_LEVEL_ERROR, TRACE_DEVICE,
            "Pending queue creation failed: %!STATUS!", status);
        return status;
    }

    TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_DEVICE, "%!FUNC! Exit");

    return status;
}

// Hardware prepare callback
NTSTATUS
HidFilterDriverPrepareHardware(
    _In_ WDFDEVICE Device,
    _In_ WDFCMRESLIST ResourcesRaw,
    _In_ WDFCMRESLIST ResourcesTranslated
)
{
    NTSTATUS status;
    PFILTER_EXTENSION filterExt;
    WDF_IO_TARGET_OPEN_PARAMS openParams;

    UNREFERENCED_PARAMETER(ResourcesRaw);
    UNREFERENCED_PARAMETER(ResourcesTranslated);

    TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_DEVICE, "%!FUNC! Entry");

    filterExt = FilterGetData(Device);

    // Set up to forward requests to the next lower driver
    WDF_IO_TARGET_OPEN_PARAMS_INIT_OPEN_BY_TYPE(
        &openParams,
        FILE_DEVICE_KEYBOARD,  // This filter can work with both mouse and keyboard
        WDF_NO_OBJECT_ATTRIBUTES
    );

    status = WdfIoTargetOpen(
        WdfDeviceGetIoTarget(Device),
        &openParams
    );

    if (!NT_SUCCESS(status)) {
        TraceEvents(TRACE_LEVEL_ERROR, TRACE_DEVICE,
            "WdfIoTargetOpen failed: %!STATUS!", status);
        return status;
    }

    filterExt->Target = WdfDeviceGetIoTarget(Device);

    TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_DEVICE, "%!FUNC! Exit");

    return status;
}

// Hardware release callback
NTSTATUS
HidFilterDriverReleaseHardware(
    _In_ WDFDEVICE Device,
    _In_ WDFCMRESLIST ResourcesTranslated
)
{
    PFILTER_EXTENSION filterExt;

    UNREFERENCED_PARAMETER(ResourcesTranslated);

    TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_DEVICE, "%!FUNC! Entry");

    filterExt = FilterGetData(Device);

    if (filterExt->Target) {
        WdfIoTargetClose(filterExt->Target);
        filterExt->Target = NULL;
    }

    TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_DEVICE, "%!FUNC! Exit");

    return STATUS_SUCCESS;
}

// I/O device control handler
VOID
HidFilterDriverIoDeviceControl(
    _In_ WDFQUEUE Queue,
    _In_ WDFREQUEST Request,
    _In_ size_t OutputBufferLength,
    _In_ size_t InputBufferLength,
    _In_ ULONG IoControlCode
)
{
    NTSTATUS status = STATUS_SUCCESS;
    PFILTER_EXTENSION filterExt;
    WDFDEVICE device;
    PVOID inputBuffer = NULL;
    PVOID outputBuffer = NULL;

    TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_QUEUE,
        "%!FUNC! Entry - Request: 0x%p", Request);

    device = WdfIoQueueGetDevice(Queue);
    filterExt = FilterGetData(device);

    switch (IoControlCode) {
    case IOCTL_HIDFILTER_SET_ACTIVE:
        // Set filter active state
        if (InputBufferLength < sizeof(BOOLEAN)) {
            status = STATUS_BUFFER_TOO_SMALL;
            break;
        }

        status = WdfRequestRetrieveInputBuffer(
            Request,
            sizeof(BOOLEAN),
            &inputBuffer,
            NULL
        );

        if (NT_SUCCESS(status)) {
            filterExt->FilterActive = *((PBOOLEAN)inputBuffer);
            TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_FILTER,
                "Filter active state set to: %d", filterExt->FilterActive);
        }
        break;

    case IOCTL_HIDFILTER_SET_SMOOTHING:
        // Set smoothing factor
        if (InputBufferLength < sizeof(LONG)) {
            status = STATUS_BUFFER_TOO_SMALL;
            break;
        }

        status = WdfRequestRetrieveInputBuffer(
            Request,
            sizeof(LONG),
            &inputBuffer,
            NULL
        );

        if (NT_SUCCESS(status)) {
            LONG value = *((PLONG)inputBuffer);
            // Validate range
            if (value >= 0 && value <= 100) {
                filterExt->SmoothingFactor = value;
                TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_FILTER,
                    "Smoothing factor set to: %d", value);
            }
            else {
                status = STATUS_INVALID_PARAMETER;
            }
        }
        break;

    case IOCTL_HIDFILTER_SET_RESPONSE:
        // Set response speed
        if (InputBufferLength < sizeof(LONG)) {
            status = STATUS_BUFFER_TOO_SMALL;
            break;
        }

        status = WdfRequestRetrieveInputBuffer(
            Request,
            sizeof(LONG),
            &inputBuffer,
            NULL
        );

        if (NT_SUCCESS(status)) {
            LONG value = *((PLONG)inputBuffer);
            // Validate range
            if (value >= 0 && value <= 100) {
                filterExt->ResponseSpeed = value;
                TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_FILTER,
                    "Response speed set to: %d", value);
            }
            else {
                status = STATUS_INVALID_PARAMETER;
            }
        }
        break;

    case IOCTL_HIDFILTER_SET_FILTERING:
        // Set filtering strength
        if (InputBufferLength < sizeof(LONG)) {
            status = STATUS_BUFFER_TOO_SMALL;
            break;
        }

        status = WdfRequestRetrieveInputBuffer(
            Request,
            sizeof(LONG),
            &inputBuffer,
            NULL
        );

        if (NT_SUCCESS(status)) {
            LONG value = *((PLONG)inputBuffer);
            // Validate range
            if (value >= 0 && value <= 100) {
                filterExt->FilteringStrength = value;
                TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_FILTER,
                    "Filtering strength set to: %d", value);
            }
            else {
                status = STATUS_INVALID_PARAMETER;
            }
        }
        break;

    case IOCTL_HIDFILTER_GET_PARAMETERS:
        // Get current parameters
        if (OutputBufferLength < sizeof(HIDFILTER_PARAMETERS)) {
            status = STATUS_BUFFER_TOO_SMALL;
            break;
        }

        status = WdfRequestRetrieveOutputBuffer(
            Request,
            sizeof(HIDFILTER_PARAMETERS),
            &outputBuffer,
            NULL
        );

        if (NT_SUCCESS(status)) {
            PHIDFILTER_PARAMETERS params = (PHIDFILTER_PARAMETERS)outputBuffer;
            params->FilterActive = filterExt->FilterActive;
            params->SmoothingFactor = filterExt->SmoothingFactor;
            params->ResponseSpeed = filterExt->ResponseSpeed;
            params->FilteringStrength = filterExt->FilteringStrength;

            WdfRequestSetInformation(Request, sizeof(HIDFILTER_PARAMETERS));
        }
        break;

    default:
        // Forward unknown IOCTLs to next driver
        status = WdfRequestForwardToIoQueue(Request, filterExt->PendingQueue);
        if (NT_SUCCESS(status)) {
            WDFREQUEST nextRequest;

            // Retrieve and forward the next request
            status = WdfIoQueueRetrieveNextRequest(
                filterExt->PendingQueue,
                &nextRequest
            );

            if (NT_SUCCESS(status)) {
                // Forward the request to the target device
                status = WdfRequestForwardToIoTarget(
                    nextRequest,
                    filterExt->Target,
                    WDF_NO_SEND_OPTIONS
                );

                if (!NT_SUCCESS(status)) {
                    TraceEvents(TRACE_LEVEL_ERROR, TRACE_QUEUE,
                        "WdfRequestForwardToIoTarget failed: %!STATUS!", status);
                    WdfRequestComplete(nextRequest, status);
                }
            }
        }
        else {
            TraceEvents(TRACE_LEVEL_ERROR, TRACE_QUEUE,
                "WdfRequestForwardToIoQueue failed: %!STATUS!", status);
            WdfRequestComplete(Request, status);
        }

        // Don't complete the request here since it's being forwarded
        return;
    }

    // Complete the request with the determined status
    WdfRequestComplete(Request, status);

    TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_QUEUE, "%!FUNC! Exit");
}

// Internal device control handler - this is where HID reports are processed
VOID
HidFilterDriverIoInternalDeviceControl(
    _In_ WDFQUEUE Queue,
    _In_ WDFREQUEST Request,
    _In_ size_t OutputBufferLength,
    _In_ size_t InputBufferLength,
    _In_ ULONG IoControlCode
)
{
    NTSTATUS status;
    PFILTER_EXTENSION filterExt;
    WDFDEVICE device;
    WDFMEMORY memory;
    PVOID buffer;
    size_t bufferLength;

    UNREFERENCED_PARAMETER(OutputBufferLength);
    UNREFERENCED_PARAMETER(InputBufferLength);

    TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_QUEUE,
        "%!FUNC! Entry - Request: 0x%p", Request);

    device = WdfIoQueueGetDevice(Queue);
    filterExt = FilterGetData(device);

    // Process HID input reports
    if (IoControlCode == IOCTL_HID_READ_REPORT) {
        // Forward to target - we'll process the response
        status = WdfRequestForwardToIoTarget(
            Request,
            filterExt->Target,
            WDF_NO_SEND_OPTIONS
        );

        if (!NT_SUCCESS(status)) {
            TraceEvents(TRACE_LEVEL_ERROR, TRACE_QUEUE,
                "WdfRequestForwardToIoTarget failed: %!STATUS!", status);
            WdfRequestComplete(Request, status);
        }

        return;
    }
    else if (IoControlCode == IOCTL_HID_WRITE_REPORT && filterExt->FilterActive) {
        // Get the report buffer
        status = WdfRequestRetrieveInputMemory(
            Request,
            &memory
        );

        if (NT_SUCCESS(status)) {
            buffer = WdfMemoryGetBuffer(memory, &bufferLength);

            // Check if this is a mouse report we want to filter
            if (bufferLength >= sizeof(MOUSE_REPORT)) {
                PMOUSE_REPORT report = (PMOUSE_REPORT)buffer;

                // Process the mouse input
                ProcessMouseInput(report, filterExt);
            }
        }
    }

    // Forward the request to the next driver
    status = WdfRequestForwardToIoTarget(
        Request,
        filterExt->Target,
        WDF_NO_SEND_OPTIONS
    );

    if (!NT_SUCCESS(status)) {
        TraceEvents(TRACE_LEVEL_ERROR, TRACE_QUEUE,
            "WdfRequestForwardToIoTarget failed: %!STATUS!", status);
        WdfRequestComplete(Request, status);
    }

    TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_QUEUE, "%!FUNC! Exit");
}

// Default request handler
VOID
HidFilterQueueDefault(
    _In_ WDFQUEUE Queue,
    _In_ WDFREQUEST Request
)
{
    PFILTER_EXTENSION filterExt;
    NTSTATUS status;

    TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_QUEUE,
        "%!FUNC! Entry - Request: 0x%p", Request);

    filterExt = FilterGetData(WdfIoQueueGetDevice(Queue));

    // Forward the request down the stack
    status = WdfRequestForwardToIoTarget(
        Request,
        filterExt->Target,
        WDF_NO_SEND_OPTIONS
    );

    if (!NT_SUCCESS(status)) {
        TraceEvents(TRACE_LEVEL_ERROR, TRACE_QUEUE,
            "WdfRequestForwardToIoTarget failed: %!STATUS!", status);
        WdfRequestComplete(Request, status);
    }

    TraceEvents(TRACE_LEVEL_INFORMATION, TRACE_QUEUE, "%!FUNC! Exit");
}

// Process mouse input data
VOID
ProcessMouseInput(
    _Inout_ PMOUSE_REPORT Report,
    _Inout_ PFILTER_EXTENSION FilterExt
)
{
    TraceEvents(TRACE_LEVEL_VERBOSE, TRACE_FILTER,
        "Processing mouse input: X=%d, Y=%d", Report->X, Report->Y);

    // If filtering is not active, return without modifying
    if (!FilterExt->FilterActive) {
        return;
    }

    // Store raw input for history
    if (!FilterExt->HistoryInitialized) {
        // Initialize history buffer
        for (ULONG i = 0; i < HISTORY_SIZE; i++) {
            FilterExt->XHistory[i] = 0;
            FilterExt->YHistory[i] = 0;
        }
        FilterExt->HistoryInitialized = TRUE;
    }

    // Store current input in history
    FilterExt->XHistory[FilterExt->HistoryIndex] = Report->X;
    FilterExt->YHistory[FilterExt->HistoryIndex] = Report->Y;

    // Update history index
    FilterExt->HistoryIndex = (FilterExt->HistoryIndex + 1) % HISTORY_SIZE;

    // Determine which filtering algorithm to use based on parameters
    if (FilterExt->SmoothingFactor > 75) {
        // Apply heavy smoothing for high smoothing factor
        ApplyExponentialSmoothing(FilterExt, &Report->X, &Report->Y);
    }
    else if (FilterExt->SmoothingFactor > 25) {
        // Apply moving average for medium smoothing factor
        ApplyMovingAverage(FilterExt, &Report->X, &Report->Y);
    }
    else {
        // Apply adaptive filtering for low smoothing factor
        ApplyAdaptiveFiltering(FilterExt, &Report->X, &Report->Y);
    }

    // Store current position for next iteration
    FilterExt->LastXPosition = Report->X;
    FilterExt->LastYPosition = Report->Y;

    TraceEvents(TRACE_LEVEL_VERBOSE, TRACE_FILTER,
        "Processed mouse output: X=%d, Y=%d", Report->X, Report->Y);
}

// Exponential smoothing algorithm
VOID
ApplyExponentialSmoothing(
    _Inout_ PFILTER_EXTENSION FilterExt,
    _Inout_ PCHAR X,
    _Inout_ PCHAR Y
)
{
    // Exponential smoothing: output = alpha * input + (1 - alpha) * lastOutput
    // Alpha is derived from smoothing factor: 0 = max smoothing, 100 = no smoothing

    // Convert smoothing factor to alpha (0.01 to 1.0)
    FLOAT alpha = (FLOAT)(100 - FilterExt->SmoothingFactor) / 100.0f;
    alpha = max(0.01f, min(1.0f, alpha));

    // Apply exponential smoothing
    LONG newX = (LONG)(*X * alpha + FilterExt->LastXOutput * (1.0f - alpha));
    LONG newY = (LONG)(*Y * alpha + FilterExt->LastYOutput * (1.0f - alpha));

    // Clamp to char range
    newX = max(-128, min(127, newX));
    newY = max(-128, min(127, newY));

    // Update last output
    FilterExt->LastXOutput = newX;
    FilterExt->LastYOutput = newY;

    // Update report
    *X = (CHAR)newX;
    *Y = (CHAR)newY;
}

// Moving average algorithm
VOID
ApplyMovingAverage(
    _Inout_ PFILTER_EXTENSION FilterExt,
    _Inout_ PCHAR X,
    _Inout_ PCHAR Y
)
{
    // Moving average across recent inputs
    // Window size depends on filtering strength

    // Determine window size (3-10)
    ULONG windowSize = 3 + (FilterExt->FilteringStrength * 7) / 100;
    windowSize = min(windowSize, HISTORY_SIZE);

    // Calculate moving average
    LONG sumX = 0;
    LONG sumY = 0;

    for (ULONG i = 0; i < windowSize; i++) {
        ULONG index = (FilterExt->HistoryIndex + HISTORY_SIZE - 1 - i) % HISTORY_SIZE;
        sumX += FilterExt->XHistory[index];
        sumY += FilterExt->YHistory[index];
    }

    LONG avgX = sumX / windowSize;
    LONG avgY = sumY / windowSize;

    // Clamp to char range
    avgX = max(-128, min(127, avgX));
    avgY = max(-128, min(127, avgY));

    // Update report
    *X = (CHAR)avgX;
    *Y = (CHAR)avgY;

    // Update last output
    FilterExt->LastXOutput = avgX;
    FilterExt->LastYOutput = avgY;
}

// Adaptive filtering algorithm
VOID
ApplyAdaptiveFiltering(
    _Inout_ PFILTER_EXTENSION FilterExt,
    _Inout_ PCHAR X,
    _Inout_ PCHAR Y
)
{
    // Adaptive filtering adjusts smoothing based on movement speed
    // Fast movements get less smoothing, slow movements get more

    // Calculate movement velocity
    LONG dX = abs(*X);
    LONG dY = abs(*Y);
    LONG velocity = dX + dY;  // Simple approximation of movement magnitude

    // Calculate adaptive alpha based on velocity and response speed
    // Higher velocity OR higher response speed = less smoothing
    FLOAT baseAlpha = (FLOAT)(FilterExt->ResponseSpeed) / 100.0f;
    FLOAT velocityFactor = min(1.0f, (FLOAT)velocity / 20.0f);  // Normalize by expected max velocity

    // Adaptive alpha: increases with velocity and response speed
    FLOAT alpha = baseAlpha + (1.0f - baseAlpha) * velocityFactor;
    alpha = max(0.1f, min(0.9f, alpha));  // Limit range

    // Apply smoothing with adaptive alpha
    LONG newX = (LONG)(*X * alpha + FilterExt->LastXOutput * (1.0f - alpha));
    LONG newY = (LONG)(*Y * alpha + FilterExt->LastYOutput * (1.0f - alpha));

    // Clamp to char range
    newX = max(-128, min(127, newX));
    newY = max(-128, min(127, newY));

    // Update last output
    FilterExt->LastXOutput = newX;
    FilterExt->LastYOutput = newY;

    // Update report
    *X = (CHAR)newX;
    *Y = (CHAR)newY;
}

// WPP Tracing cleanup on driver unload
VOID
DriverUnload(
    _In_ WDFDRIVER Driver
)
{
    UNREFERENCED_PARAMETER(Driver);

    WPP_CLEANUP(WdfDriverGetDriverObject(Driver));
}#pragma once
