// Import tab list formatting functions
import { formatTabInfo, formatOrganizedTabInfo } from './tabList.js';

// Stores the last chat response for each tab by tab ID
const lastChatResponse = {};

// Cache for categorized tabs
let tabsCache = {
    tabs: null,  // The original tab data used for categorization
    categories: null  // The categorized tabs from Claude
};

document.addEventListener('DOMContentLoaded', function() {
    console.log("tablm is running");

    // Retrieve and display the tabs upon loading
    updateTabsList(false);

    //trigger similar behaviour to onactivated listener when the window is brought to the foreground
    chrome.windows.onFocusChanged.addListener((windowId) => {
        console.log("window brought to foreground", windowId);
        updateTabsList(false);
    });

    // Add sort checkbox listener
    document.getElementById('sort-by-domain').addEventListener('change', function() {
        updateTabsList(false);
    });
    
    // START :Chrome tab event listeners
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
        console.log("tab activated", activeInfo);
        // Remove active classes from all elements
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.classList.remove('active-tab');
        });
        document.querySelectorAll('[data-window-id]').forEach(window => {
            window.classList.remove('active-window');
        });

        // Get the newly active tab element
        const activeTabElement = document.querySelector(`[data-tab-id="${activeInfo.tabId}"]`);
        const windowElement = document.querySelector(`li[data-window-id="${activeInfo.windowId}"]`);
        
        if (activeTabElement) {
            activeTabElement.classList.add('active-tab');
        }
        if (windowElement) {
            windowElement.classList.add('active-window');
        }
        
        // Load the last chat response for this tab if we're in chat view
        const chatBox = document.getElementById('chat-response');
        const chatView = document.getElementById('chat');
        if (chatView.style.display === 'block' && lastChatResponse[activeInfo.tabId]) {
            chatBox.style.display = 'block';
            chatBox.innerHTML = lastChatResponse[activeInfo.tabId];
        }
        
        scrollToActiveTab();
    });

    chrome.tabs.onCreated.addListener(() => {
        console.log("adding tab");
        updateTabsList(false);
    });
    
    chrome.tabs.onRemoved.addListener(() => {
        console.log("removing tab");
        updateTabsList(false);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        console.log("tab updated", tabId, changeInfo, tab);
        if (changeInfo.url) {
            console.log("tab URL changed");
            updateTabsList(false);
        }
    });
    // END : chrome tab event listeners

    // Add search input listener
    document.getElementById('tab-search').addEventListener('input', function() {
        updateTabsList(false);
    });

    // Update the textarea input listener for Enter key
    document.getElementById('chat-textarea').addEventListener('keypress', async function(e) {
        const apiKey = document.getElementById('api-key').value.trim();
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default newline
            const chatBox = document.getElementById('chat-response');
            const userInput = this.value;
    
            // Clear the textarea
            this.value = '';
        
            // Create and display the user's message
            chatBox.style.display = 'block';
            
            // Create a new div for the user's message
            const userMessageDiv = document.createElement('div');
            userMessageDiv.className = 'user-message';
            userMessageDiv.textContent = userInput;
            chatBox.appendChild(userMessageDiv);
            
            // Create and append loading message
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'assistant-message';
            loadingDiv.textContent = 'Loading...';
            chatBox.appendChild(loadingDiv);
            
            // Scroll to bottom of chat
            chatBox.scrollTop = chatBox.scrollHeight;
            
            const pageInfo = await getCurrentTabContent();
            if (pageInfo) {
                const response = await sendPromptToClaude(userInput, pageInfo.content, apiKey);
                if (response.error) {
                    console.error('Claude API Error:', response.error);
                    loadingDiv.textContent = 'Error: ' + response.error;
                } else {
                    console.log('Claude Response:', response.content[0].text);
                    loadingDiv.textContent = response.content[0].text;
                    // Store the entire chat HTML content
                    lastChatResponse[pageInfo.tabId] = chatBox.innerHTML;
                }
                // Scroll to bottom again after response
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        }
});

    // Add event listener to store API key on blur
    const apiKeyInput = document.getElementById('api-key');
    apiKeyInput.addEventListener('blur', function() {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            sessionStorage.setItem('apiKey', apiKey);
            console.log('API key stored in session storage');
}
    });

    // Retrieve and set the API key from session storage on load
    const storedApiKey = sessionStorage.getItem('apiKey');
    if (storedApiKey) {
        apiKeyInput.value = storedApiKey;
        console.log('API key retrieved from session storage');
}

    document.getElementById('nav-chat').addEventListener('click', async function(e) {
        e.preventDefault();
        this.classList.add('active-tab');
        document.getElementById('nav-tabs').classList.remove('active-tab');
        document.getElementById('nav-organised-tabs').classList.remove('active-tab');

        // Hide tabs list and show chat elements
        document.getElementById('tabs-list').style.display = 'none';
        document.getElementById('organised-tabs').style.display = 'none';
        document.getElementById('chat').style.display = 'block';
    
        // Get current tab ID and show previous chat if it exists
        const activeTab = await getActiveTab();
        const chatBox = document.getElementById('chat-response');
        if (activeTab && lastChatResponse[activeTab.id]) {
            chatBox.style.display = 'block';
            chatBox.innerHTML = lastChatResponse[activeTab.id];
    } else {
            chatBox.style.display = 'none';
            chatBox.innerHTML = '';
    }
    });
    
    document.getElementById('nav-tabs').addEventListener('click', function(e) {
        e.preventDefault();
        this.classList.add('active-tab');
        document.getElementById('nav-chat').classList.remove('active-tab');
        document.getElementById('nav-organised-tabs').classList.remove('active-tab');

        // Show tabs list and hide other sections
        document.getElementById('tabs-list').style.display = 'block';
        document.getElementById('organised-tabs').style.display = 'none';
        document.getElementById('chat').style.display = 'none';
    });

    document.getElementById('nav-organised-tabs').addEventListener('click', async function(e) {
        e.preventDefault();
        this.classList.add('active-tab');
        document.getElementById('nav-tabs').classList.remove('active-tab');
        document.getElementById('nav-chat').classList.remove('active-tab');
    
        // Show organised tabs and hide other sections
        document.getElementById('tabs-list').style.display = 'none';
        document.getElementById('organised-tabs').style.display = 'block';
        document.getElementById('chat').style.display = 'none';

        // Show loading state
        document.getElementById('organised-tabs').innerHTML = '<div class="loading">Organizing tabs...</div>';

        // Update with organized view
        await updateTabsList(true);
            });

});


//send prompt to Claude
function sendPromptToClaude(prompt, context, apiKey) {
    console.log("sending prompt to claude", prompt, context, apiKey);
    return fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
            model: "claude-3-5-haiku-latest",
            max_tokens: 8192,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt+"\n\n"+context },
                    ],
                },
            ],
        }),
    })
   .then((response) => response.json())
}

// UI helper functions
function getSortType() {
    return document.getElementById('sort-by-domain').checked ? 'domain' : 'index';
}

function getSearchTerm() {
    return document.getElementById('tab-search').value.toLowerCase();
}

// Function to update the tabs list
async function updateTabsList(isOrganizedView = false) {
    const tabs = await retrieveChromeTabs();
    
    if (isOrganizedView) {
        const organizedTabs = await getOrganizedTabsFromClaude(tabs);
        document.getElementById('organised-tabs').innerHTML = formatOrganizedTabInfo(organizedTabs, tabs);
    } else {
        document.getElementById('tabs-list').innerHTML = formatTabInfo(tabs, getSortType(), getSearchTerm());
    }
    
    registerTabEventHandlers();
    scrollToActiveTab();
}

// Register event handlers for tab interactions
function registerTabEventHandlers() {
    // Close button handlers
    document.querySelectorAll('.close-tab-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const tabId = parseInt(this.getAttribute('data-tab-id'));
            await chrome.tabs.remove(tabId);
            
            // Check if we're in organized view or regular view
            const isOrganizedView = document.getElementById('organised-tabs').style.display === 'block';
            await updateTabsList(isOrganizedView);
        });
    });

    // Tab link handlers
    document.querySelectorAll('.tab-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabId = parseInt(this.getAttribute('data-tab-id'));
            chrome.tabs.update(tabId, { active: true }, function(tab) {
                chrome.windows.update(tab.windowId, { focused: true });
            });
        });
    });
}

// Scroll to active tab
function scrollToActiveTab() {
    const activeTab = document.querySelector('.active-window .tab-item.active-tab');
    if (activeTab) {
        setTimeout(() => {
            const headerHeight = document.querySelector('.inline-controls').offsetHeight;
            const tabPosition = activeTab.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({
                top: tabPosition - headerHeight - 20,
                behavior: 'smooth'
            });
        }, 100);
    }
}

async function retrieveChromeTabs() {
    // Get all tabs and the current window in parallel
    const [tabs, currentWindow] = await Promise.all([
        chrome.tabs.query({}),
        chrome.windows.getCurrent()
    ]);
    
    let windows = {};
    const currentTime = new Date().getTime();
    
    // Group tabs by windowId
    tabs.forEach(tab => {
        if (!windows[tab.windowId]) {
            windows[tab.windowId] = {};
        }
        let domain = '';
        try {
            domain = new URL(tab.url).hostname;
        } catch (error) {
            console.warn(`Failed to parse URL for tab ${tab.id}:`, error);
        }
        //TODO: Include windowId and tabId in the tab object. Possibly flatten the structure to be a list of tabs indexed by tabId
        windows[tab.windowId][tab.id] = {
            url: tab.url,
            title: tab.title,
            domain: domain,
            openDuration: currentTime - tab.lastAccessed,
            index: tab.index,
            active: tab.active
        };
    });

    return {
        windows: windows,
        activeWindowId: currentWindow.id
    };
}

//Below this, code is not NOT USED - to be removed
function registerSubmitEventListener(){
    var keyAchievementsText = '';
    document.getElementById('submit').addEventListener('click', function(event) {
        event.preventDefault();
        const systemPrompt = document.getElementById('system-prompt').value.trim()
        saveFields({systemPrompt: systemPrompt});
        fetchAPI(keyAchievementsText, systemPrompt, populateFeedbackRows);
    });
};


//Functions to update or retrieve from the the Extension UI
function updateNotification(text, overwrite=false) {
    if(overwrite) {
        document.getElementById('results').textContent = text;
    } else {
        document.getElementById('results').textContent = text + '\n' + document.getElementById('results').textContent;
    }
}

// Functions that interact with GrabGPT API
function populateModelList(){
    fetch('https://public-api.grabgpt.managed.catwalk-k8s.stg-myteksi.com/models')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            updateNotification('Successfully connected to GrabGPT API');
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            updateNotification('Are you connected to the VPN?', true);
        });
}

function fetchAPI(userPrompt, systemPrompt, successFn) {
    const apiKey = document.getElementById('api-key').value.trim();
    const loadingBar = document.getElementById('loading-bar');
    if(apiKey === '') {
        updateNotification('Please display settings and populate your GrabGTP API key');
        return;
    }
    const modelType = document.getElementById('model-type').value.trim();
    //save the latest value from fields
    saveFields({apiKey: apiKey, modelType: modelType});

    const url = 'https://public-api.grabgpt.managed.catwalk-k8s.stg-myteksi.com/openai/deployments/'+ modelType+'/chat/completions?api-version=2023-03-15-preview';

    console.log('api key', apiKey);
    console.log('system prompt', systemPrompt);
    console.log('user prompt', userPrompt);

    const data = {
        "messages": [
            {
                "role": "system",
                "content": systemPrompt, 
            },
            {
                "role": "user",
                "content": userPrompt,
            }
        ],
        "temperature": 0
    };
    loadingBar.style.display = 'block';
    fetch(url, {
        method: 'POST',
        headers: {
            'api-key' : apiKey, 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify(data) 
    }).then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log("RAW API response >>>>", data["choices"][0]["message"].content);
        successFn(JSON.parse(data["choices"][0]["message"].content));
    })
    .catch(error => {
        console.error('Error fetching data:', error);
        updateNotification('Failed to fetch data from GrabGPT API');
    }).finally(() => {
        loadingBar.style.display = 'none';
    });
};

// Helper function to check if tabs have changed and update cache for removals
function haveTabsChanged(newTabs) {
    if (!tabsCache.tabs) return true;
    
    let hasChanges = false;
    const updatedCategories = {};
    
    // First check if any new windows were added
    if (Object.keys(newTabs.windows).length > Object.keys(tabsCache.tabs.windows).length) {
        return true;
    }
    
    // Go through each window in the new tabs
    for (const windowId in newTabs.windows) {
        const newWindow = newTabs.windows[windowId];
        const cachedWindow = tabsCache.tabs.windows[windowId];
        
        // If there's a new window, that's a change
        if (!cachedWindow) return true;
        
        // If new tabs were added to this window, that's a change
        if (Object.keys(newWindow).length > Object.keys(cachedWindow).length) {
            return true;
        }
        
        // Check each tab in the new window
        for (const tabId in newWindow) {
            const newTab = newWindow[tabId];
            const cachedTab = cachedWindow[tabId];
            
            // If there's a new tab or a tab was modified, that's a change
            if (!cachedTab || 
                newTab.url !== cachedTab.url || 
                newTab.title !== cachedTab.title) {
                return true;
            }
        }
    }
    
    // If we get here, only removals happened (or no changes)
    // Update the categories by removing deleted tabs
    for (const category in tabsCache.categories) {
        const remainingTabIds = tabsCache.categories[category].filter(tabId => {
            // Check if this tabId exists in any window of the new tabs
            for (const windowId in newTabs.windows) {
                if (newTabs.windows[windowId][tabId]) {
                    return true;
                }
            }
            return false;
        });
        
        if (remainingTabIds.length > 0) {
            updatedCategories[category] = remainingTabIds;
            if (remainingTabIds.length !== tabsCache.categories[category].length) {
                hasChanges = true;
            }
        } else {
            hasChanges = true;
        }
    }
    
    // Update cache if we only had removals
    if (hasChanges) {
        tabsCache.tabs = JSON.parse(JSON.stringify(newTabs));
        tabsCache.categories = updatedCategories;
    }
    
    return false;
}
//TODO: getOrganizedTabsFromClaude,  haveTabsChanged, queryClaudeForTabs and tabsCache should be moved into its own module
// Add new function to get organized tabs from Claude
async function getOrganizedTabsFromClaude(tabData) {
    // Check if anything changed (and handle removals if that's all that changed)
    if (haveTabsChanged(tabData)) {
        return await queryClaudeForTabs(tabData);
    }

    console.log("Using cached organized tabs");
    return tabsCache.categories;
}

// Helper function to query Claude for new organization
// TODO: Add ability to provide a list of categories as a config option
async function queryClaudeForTabs(tabData) {
    const apiKey = document.getElementById('api-key').value.trim();
    if (!apiKey) {
        alert('Please enter your Claude API key first');
        return null;
    }

    // Flatten the tabs into an array while ensuring proper JSON escaping
    let allTabs = [];
    for (let windowId in tabData.windows) {
        for (let tabId in tabData.windows[windowId]) {
            allTabs.push({
                ...tabData.windows[windowId][tabId],
                id: parseInt(tabId),
                windowId: parseInt(windowId)
            });
        }
    }

    const prompt = `<task>Organize ${allTabs.length} browser tabs into logical categories based on their content and purpose. Every tab must be assigned to exactly one category - ensure all ${allTabs.length} tabs are categorized.</task>

<output_format>
The response should be a valid JSON object where:
- keys are category names (e.g. "AI research", "Engineering productivity", "Architecture research", "Meeting notes", "Strategy docs", "1-1 notes", "News", "Postmortems", "Technical docs", "News")
- values are arrays containing ONLY tab IDs (numbers)
- the sum of all tabs across categories must equal ${allTabs.length}
Example structure:
{
    "Category1": [1, 2],
    "Category2": [3, 4]
}
</output_format>

<input_data>
${JSON.stringify(allTabs, null, 2)}
</input_data>

Return ONLY the JSON object, with no additional text or explanation.`.trim();

    try {
        const response = await sendPromptToClaude(prompt, '', apiKey);
        if (response.error) {
            console.error('Claude API Error:', response.error);
            return null;
        }
        
        // Parse the JSON response from Claude (contains only categories and tab IDs)
        const categorizedTabIds = JSON.parse(response.content[0].text);
        
        // Update cache - a reference is sufficient since we don't modify the data
        tabsCache.tabs = tabData;
        tabsCache.categories = categorizedTabIds;
        
        return categorizedTabIds;
    } catch (error) {
        console.error('Error organizing tabs:', error);
        return null;
    }
}

async function getCurrentTabContent() {
    const activeTab = await getActiveTab();
    if (!activeTab) return null;

    const results = await chrome.scripting.executeScript({
        target: {tabId: activeTab.id},
        function: () => document.body.innerText
    });

    return {
        tabId: activeTab.id,
        content: results[0].result
    };
}

async function getActiveTab() {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    return tabs[0];
}

// Helper function to format duration
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


