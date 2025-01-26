// Tab list formatting and rendering

// Format the tab information in a way that is easily read
export function formatTabInfo(tabData, sortBy = 'index', searchTerm = '') {
    let output = '<ul>';
    const { windows, activeWindowId } = tabData;
    
    for (let windowId in windows) {
        let windowHasTabs = false;
        let windowTabs = '';
        
        const sortedTabs = getSortedTabs(windows[windowId], sortBy, searchTerm);
        
        for (let [tabId, tab] of sortedTabs) {
            windowHasTabs = true;
            tab.id = tabId;
            windowTabs += renderTabItem(tab, windowId);
        }
        
        if (windowHasTabs) {
            output += renderWindowSection(windowId, windowTabs, windowId == activeWindowId);
        }
    }
    
    output += '</ul>';
    return output;
}

// Format organized tabs info
export function formatOrganizedTabInfo(categorizedTabs) {
    if (!categorizedTabs) {
        return '<div class="error">Failed to organize tabs. Please try again.</div>';
    }

    let output = '<ul>';
    const sortedCategories = Object.keys(categorizedTabs).sort();
    
    for (const category of sortedCategories) {
        const tabs = categorizedTabs[category];
        if (tabs.length > 0) {
            output += `<li>${category} (${tabs.length}):<ul>`;
            tabs.forEach(tab => {
                output += renderTabItem(tab, tab.windowId);
            });
            output += '</ul></li>';
        }
    }
    
    output += '</ul>';
    return output;
}

// Helper function to get sorted and filtered tabs
function getSortedTabs(windowTabs, sortBy, searchTerm) {
    return Object.entries(windowTabs)
        .filter(([_, tab]) => {
            return tab.title.toLowerCase().includes(searchTerm) || 
                   tab.url.toLowerCase().includes(searchTerm);
        })
        .sort((a, b) => {
            if (sortBy === 'domain') {
                return a[1].domain.localeCompare(b[1].domain);
            }
            return a[1].index - b[1].index;
        });
}

// Render a single tab item
function renderTabItem(tab, windowId) {
    const activeClass = tab.active ? 'active-tab' : '';
    const duration = formatDuration(tab.openDuration);
    
    return `
        <li class="tab-item ${activeClass}" data-tab-id="${tab.id}" data-window-id="${windowId}">
            <div><a href="#" class="tab-link" data-tab-id="${tab.id}">${tab.title}</a>(${tab.domain})</div>
            <div>Open for: ${duration}</div>
            <button class="close-tab-btn outline" data-tab-id="${tab.id}">Close Tab</button>
        </li>`;
}

// Render a window section
function renderWindowSection(windowId, tabs, isActiveWindow) {
    const activeWindowClass = isActiveWindow ? 'active-window' : '';
    return `
        <li data-window-id="${windowId}" class="${activeWindowClass}">
            Window ${windowId}:
            <ul class="tab-list">
                ${tabs}
            </ul>
        </li>`;
}

// Format duration helper
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
} 