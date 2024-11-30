// Stores the last chat response for each tab by tab ID
const lastChatResponse = {};

document.addEventListener('DOMContentLoaded', function() {
    console.log("tablm is running");
    retrieveChromeTabs().then((result) => { 
        updateTabsList(formatTabInfo(result, getSortType(), getSearchTerm())); 
    });
    
    // Add sort checkbox listener
    document.getElementById('sort-by-domain').addEventListener('change', function() {
        retrieveChromeTabs().then((result) => { 
            updateTabsList(formatTabInfo(result, getSortType(), getSearchTerm())); 
        });
    });
    
    // Add Chrome tab event listeners
    chrome.tabs.onCreated.addListener(() => {
        console.log("adding tab");
        retrieveChromeTabs().then((result) => { updateTabsList(formatTabInfo(result, getSortType(), getSearchTerm())); });

    });
    
    chrome.tabs.onRemoved.addListener(() => {
        console.log("removing tab");
        retrieveChromeTabs().then((result) => { updateTabsList(formatTabInfo(result, getSortType(), getSearchTerm())); });
    });

    // Add listener for URL changes
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.url) {
            console.log("tab URL changed");
            retrieveChromeTabs().then((result) => { updateTabsList(formatTabInfo(result, getSortType(), getSearchTerm())); });
        }
    });

    // Add search input listener
    document.getElementById('tab-search').addEventListener('input', function() {
        retrieveChromeTabs().then((result) => { 
            updateTabsList(formatTabInfo(result, getSortType(), getSearchTerm())); 
        });
    });

    // Add textarea visibility toggle listener
    document.getElementById('show-textarea').addEventListener('change', async function() {
        const textarea = document.getElementById('tab-list-textarea');
        const chatBox = document.getElementById('chat-response');
        textarea.style.display = this.checked ? 'block' : 'none';
        
        if (!this.checked) {
            chatBox.style.display = 'none';
        } else {
            // Get current tab ID
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            if (tabs[0] && lastChatResponse[tabs[0].id]) {
                chatBox.style.display = 'block';
                chatBox.textContent = lastChatResponse[tabs[0].id];
            }
        }
    });

    // Add textarea input listener for Enter key
    document.getElementById('tab-list-textarea').addEventListener('keypress', async function(e) {
        const apiKey = document.getElementById('api-key').value.trim();
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default newline
            const chatBox = document.getElementById('chat-response');
            chatBox.style.display = 'block';
            chatBox.textContent = 'Loading...';
            
            const pageInfo = await getCurrentTabContent();
            if (pageInfo) {
                const response = await sendPromptToClaude(this.value, pageInfo.content, apiKey);
                if (response.error) {
                    console.error('Claude API Error:', response.error);
                    lastChatResponse[pageInfo.tabId] = 'Error: ' + response.error;
                } else {
                    console.log('Claude Response:', response.content[0].text);
                    lastChatResponse[pageInfo.tabId] = response.content[0].text;
                }
                chatBox.textContent = lastChatResponse[pageInfo.tabId];
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
});


//send prompt to Claude
function sendPromptToClaude(prompt, context, apiKey) {
    return fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 1024,
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

// Format the tab information in a way that is easily read
function formatTabInfo(tabInfo, sortBy = 'index', searchTerm = '') {
    console.log('tabInfo', tabInfo);
    let output = '<ul>';
    
    for (let windowId in tabInfo) {
        let windowHasTabs = false;
        let windowOutput = `<li class="window-container" data-window-id="${windowId}">Window ${windowId}:<ul class="tab-list">`;
        
        const sortedTabs = Object.entries(tabInfo[windowId])
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
        
        for (let [tabId, tab] of sortedTabs) {
            windowHasTabs = true;
            const duration = formatDuration(tab.openDuration);
            
            windowOutput += `<li class="tab-item" draggable="true" data-tab-id="${tabId}" data-window-id="${windowId}">
                <div><a href="#" class="tab-link" data-tab-id="${tabId}">${tab.title}</a>(${tab.domain})</div>
                <div>Open for: ${duration}</div>
                <button class="close-tab-btn outline" data-tab-id="${tabId}">Close Tab</button>
            </li>`;
        }
        windowOutput += '</ul></li>';
        
        if (windowHasTabs) {
            output += windowOutput;
        }
    }
    
    output += '</ul>';
    return output;
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


//Functions to update or retrieve from the the Extension UI
function updateTabsList(tabListHTML) {
    document.getElementById('tabs-list').innerHTML = tabListHTML;
    registerTabCloseListeners();
    registerBringTabForward();
}

// Add this new function to handle tab closure
function registerTabCloseListeners() {
    document.querySelectorAll('.close-tab-btn').forEach(button => {
        button.addEventListener('click', function() {
            const tabId = parseInt(this.getAttribute('data-tab-id'));
            chrome.tabs.remove(tabId, function() {
                // Refresh the tab list after closing
                retrieveChromeTabs().then((result) => { 
                    updateTabsList(formatTabInfo(result, getSortType(), getSearchTerm()));
                });
            });
        });
    });
}

function registerBringTabForward() {
    document.querySelectorAll('.tab-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabId = parseInt(this.getAttribute('data-tab-id'));
            console.log("tabId", tabId, "clicked");
            chrome.tabs.update(tabId, { active: true }, function(tab) {
                chrome.windows.update(tab.windowId, { focused: true });
            });
        });
    });
}


async function getCurrentTabContent() {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs[0]) return null;
    
    const results = await chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: () => document.body.innerText
    });
    
    return {
        tabId: tabs[0].id,
        content: results[0].result
    };
}

async function retrieveChromeTabs() {
    const tabs = await chrome.tabs.query({});
    let tabInfo = {};
    const currentTime = new Date().getTime();
    
    // Group tabs by windowId
    tabs.forEach(tab => {
        if (!tabInfo[tab.windowId]) {
            tabInfo[tab.windowId] = {};
        }
        let domain = '';
        try {
            domain = new URL(tab.url).hostname;
        } catch (error) {
            console.warn(`Failed to parse URL for tab ${tab.id}:`, error);
        }
        tabInfo[tab.windowId][tab.id] = {
            url: tab.url,
            title: tab.title,
            domain: domain,
            openDuration: currentTime - tab.lastAccessed,
            index: tab.index
        };
    });
    return tabInfo;
}

//Below this, code is not NOT USED - to be removed
function registerDisplaySettingsListener(){
    document.getElementById('display-settings').addEventListener('change', function() {
        if(this.checked) {
            document.getElementById('settings').style.display = 'block';
        } else {
            document.getElementById('settings').style.display = 'none';
        }
    });
}

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