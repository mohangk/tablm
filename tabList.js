// Tab list formatting and rendering

// Format the tab information in a way that is easily read
export function formatTabInfo(tabData, sortBy = 'index', searchTerm = '') {
    let output = '<ul>';
    const { tabs, activeWindowId } = tabData;
    
    // Group tabs by windowId first
    const tabsByWindow = {};
    Object.values(tabs).forEach(tab => {
        if (!tabsByWindow[tab.windowId]) {
            tabsByWindow[tab.windowId] = [];
        }
        tabsByWindow[tab.windowId].push(tab);
    });
    
    for (let windowId in tabsByWindow) {
        let windowTabs = '';
        
        const sortedTabs = getSortedTabs(tabsByWindow[windowId], sortBy, searchTerm);
        
        if (sortedTabs.length > 0) {
            sortedTabs.forEach(tab => {
                windowTabs += renderTabItem(tab, windowId);
            });
            output += renderWindowSection(windowId, windowTabs, windowId == activeWindowId);
        }
    }
    
    output += '</ul>';
    return output;
}

// Format organized tabs info
export function formatOrganizedTabInfo(categories, tabData) {
    if (!categories) {
        return '<div class="error">Failed to organize tabs</div>';
    }

    let html = '<ul class="windows-list">';
    
    for (const category in categories) {
        html += `<li class="window-item">
            <div class="window-header">${category}</div>
            <ul class="tabs-list">`;
        
        // Get tab IDs for this category
        const tabIds = categories[category];
        
        // Look up each tab's data from the provided tabData
        tabIds.forEach(tabId => {
            const tab = tabData[tabId];
            if (tab) {
                html += renderTabItem(tab, tab.windowId);
            }
        });
        
        html += '</ul></li>';
    }
    
    html += '</ul>';
    return html;
}

// Helper function to get sorted and filtered tabs
function getSortedTabs(tabs, sortBy, searchTerm) {
    return tabs
        .filter(tab => {
            return tab.title.toLowerCase().includes(searchTerm) || 
                   tab.url.toLowerCase().includes(searchTerm);
        })
        .sort((a, b) => {
            if (sortBy === 'domain') {
                return a.domain.localeCompare(b.domain);
            }
            return a.index - b.index;
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