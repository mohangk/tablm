// Import tab list formatting functions
import { formatTabInfo, formatOrganizedTabInfo } from './tabList.js';

// Stores the last chat response for each tab by tab ID
const lastChatResponse = {};

// Cache for categorized tabs
let tabsCache = {
    tabs: null,  // The flat tab data indexed by tab ID
    categories: null  // The categorized tabs from Claude
};

// Configuration management
const defaultConfig = {
    apiDialect: 'anthropic',
    provider: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-haiku-latest',
    apiKey: ''
};

function validateAndMergeConfig(config) {
    const requiredKeys = Object.keys(defaultConfig);
    const missingKeys = requiredKeys.filter(key => !(key in config));

    if (missingKeys.length > 0) {
        console.warn('Loaded profile is missing required properties:', missingKeys, 'Using defaults for them.');
        // Return a new object with defaults for missing keys, preserving existing values
        return { ...defaultConfig, ...config };
    }

    return config; // No missing keys, return as is.
}

function loadConfiguration(profileName) {
    let profiles = JSON.parse(localStorage.getItem('aiConfigProfiles')) || {};
    let activeProfileName = localStorage.getItem('activeProfileName');

    // First run: create default profile
    if (Object.keys(profiles).length === 0) {
        profiles = { 'default': { ...defaultConfig } };
        localStorage.setItem('aiConfigProfiles', JSON.stringify(profiles));
        activeProfileName = 'default';
        localStorage.setItem('activeProfileName', activeProfileName);
    }

    // If a specific profile is requested, load it and set it as active
    if (profileName && profiles[profileName]) {
        activeProfileName = profileName;
        localStorage.setItem('activeProfileName', activeProfileName);
    }

    // Fallback to default if active profile is invalid or not found
    if (!activeProfileName || !profiles[activeProfileName]) {
        activeProfileName = 'default';
        localStorage.setItem('activeProfileName', activeProfileName);
    }

    const activeProfileConfig = profiles[activeProfileName];
    
    return validateAndMergeConfig(activeProfileConfig);
}

function saveConfiguration(config, profileName) {
    if (!profileName) {
        console.error("Profile name is required to save configuration.");
        return;
    }
    const profiles = JSON.parse(localStorage.getItem('aiConfigProfiles')) || {};
    profiles[profileName] = config;
    localStorage.setItem('aiConfigProfiles', JSON.stringify(profiles));
    localStorage.setItem('activeProfileName', profileName); // Set saved profile as active
    console.log(`Configuration saved to profile '${profileName}':`, config);
}

function deleteConfiguration(profileName) {
    if (profileName === 'default') {
        console.warn("Cannot delete the default profile.");
        return;
    }
    let profiles = JSON.parse(localStorage.getItem('aiConfigProfiles')) || {};
    if (profiles[profileName]) {
        delete profiles[profileName];
        localStorage.setItem('aiConfigProfiles', JSON.stringify(profiles));
        console.log(`Profile '${profileName}' deleted.`);

        // If the deleted profile was the active one, switch back to default
        const activeProfileName = localStorage.getItem('activeProfileName');
        if (activeProfileName === profileName) {
            localStorage.setItem('activeProfileName', 'default');
        }
    }
}

function getEndpointForProvider(provider, dialect) {
    const endpoints = {
        anthropic: 'https://api.anthropic.com/v1/messages',
        openai: 'https://api.openai.com/v1/chat/completions',
        together: 'https://api.together.xyz/v1/chat/completions',
        groq: 'https://api.groq.com/openai/v1/chat/completions'
    };

    if (provider === 'custom') return '';
    return endpoints[provider] || endpoints.anthropic;
}

let configUIMode = 'view'; // Can be 'view', 'edit', or 'create'

function renderConfigUI() {
    const fieldset = document.getElementById('api-settings-fieldset');
    const inputs = fieldset.querySelectorAll('input, select');
    const profileSelect = document.getElementById('profile-select');
    const newProfileNameInput = document.getElementById('new-profile-name');

    const isViewMode = configUIMode === 'view';
    const isEditMode = configUIMode === 'edit';
    const isCreateMode = configUIMode === 'create';

    // Set readonly state for all API settings
    inputs.forEach(input => input.disabled = isViewMode);

    // Toggle profile selector
    profileSelect.style.display = isCreateMode ? 'none' : 'block';
    profileSelect.disabled = !isViewMode;
    newProfileNameInput.style.display = isCreateMode ? 'block' : 'none';

    // Toggle button visibility
    document.getElementById('edit-profile-btn').style.display = isViewMode ? 'block' : 'none';
    document.getElementById('new-profile-btn').style.display = isViewMode ? 'block' : 'none';
    document.getElementById('save-profile-btn').style.display = isViewMode ? 'none' : 'block';
    document.getElementById('cancel-profile-btn').style.display = isViewMode ? 'none' : 'block';
    document.getElementById('delete-profile-btn').style.display = isEditMode ? 'block' : 'none';
    
    // Additional logic for delete button based on profile name
    if (isEditMode) {
        document.getElementById('delete-profile-btn').disabled = (profileSelect.value === 'default');
    }
}

function updateConfigurationUI() {
    const config = loadConfiguration();
    
    // Populate Profile Dropdown
    const profileSelect = document.getElementById('profile-select');
    const profiles = JSON.parse(localStorage.getItem('aiConfigProfiles')) || {};
    const activeProfileName = localStorage.getItem('activeProfileName');
    profileSelect.innerHTML = ''; // Clear existing options
    for (const profileName in profiles) {
        const option = document.createElement('option');
        option.value = profileName;
        option.textContent = profileName;
        if (profileName === activeProfileName) {
            option.selected = true;
        }
        profileSelect.appendChild(option);
    }
    
    // Set dialect radio buttons
    document.getElementById('dialect-anthropic').checked = config.apiDialect === 'anthropic';
    document.getElementById('dialect-openai').checked = config.apiDialect === 'openai';

    // Set provider dropdown
    document.getElementById('provider-select').value = config.provider;

    // Set model and API key
    document.getElementById('model-name').value = config.model;
    document.getElementById('api-key').value = config.apiKey;

    // Always show endpoint field, but make it readonly for predefined providers
    const endpointField = document.getElementById('custom-endpoint');
    endpointField.value = config.endpoint;

    if (config.provider === 'custom') {
        endpointField.readOnly = false;
        endpointField.style.backgroundColor = '';
    } else {
        endpointField.readOnly = true;
        endpointField.style.backgroundColor = '#f5f5f5';
    }

    renderConfigUI(); // Render the UI in its current state
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log("tablm is running");

    // Get current window ID for initial load
    const currentWindow = await chrome.windows.getCurrent();
    // Retrieve and display the tabs upon loading
    updateTabsList(false, currentWindow.id);

    //trigger similar behaviour to onactivated listener when the window is brought to the foreground
    chrome.windows.onFocusChanged.addListener((windowId) => {
        console.log("window brought to foreground", windowId);
        updateTabsList(false, windowId);
    });

    // Add sort checkbox listener
    document.getElementById('sort-by-domain').addEventListener('change', async function() {
        const currentWindow = await chrome.windows.getCurrent();
        updateTabsList(false, currentWindow.id);
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

    chrome.tabs.onCreated.addListener((tab) => {
        console.log("adding tab");
        updateTabsList(false, tab.windowId);
    });
    
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
        console.log("removing tab");
        updateTabsList(false, removeInfo.windowId);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        console.log("tab updated", tabId, changeInfo, tab);
        if (changeInfo.url) {
            console.log("tab URL changed");
            updateTabsList(false, tab.windowId);
        }
    });
    // END : chrome tab event listeners

    // Add search input listener
    document.getElementById('tab-search').addEventListener('input', async function() {
        const currentWindow = await chrome.windows.getCurrent();
        updateTabsList(false, currentWindow.id);
    });

    // Update the textarea input listener for Enter key
    document.getElementById('chat-textarea').addEventListener('keypress', async function(e) {
        const config = loadConfiguration();
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
                const response = await sendPromptToAI(userInput, pageInfo.content, config);
                const result = extractResponseContent(response, config);

                if (result.error) {
                    console.error('AI API Error:', result.error);
                    loadingDiv.textContent = 'Error: ' + result.error;
                } else {
                    console.log('AI Response:', result.content);
                    loadingDiv.textContent = result.content;
                    // Store the entire chat HTML content
                    lastChatResponse[pageInfo.tabId] = chatBox.innerHTML;
                }
                // Scroll to bottom again after response
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        }
    });

    // Configuration event listeners (scoped to specific controls)
    function handleDialectChange(e) {
        const dialect = e.target.value;
        const provider = document.getElementById('provider-select').value;
        if (provider !== 'custom') {
            const endpoint = getEndpointForProvider(provider, dialect);
            document.getElementById('custom-endpoint').value = endpoint;
        }
    }

    function handleProviderChange(e) {
        const provider = e.target.value;
        const dialect = document.querySelector('input[name="api-dialect"]:checked').value;
        const endpoint = getEndpointForProvider(provider, dialect);

        const endpointField = document.getElementById('custom-endpoint');
        endpointField.value = endpoint;

        if (provider === 'custom') {
            endpointField.readOnly = false;
            endpointField.style.backgroundColor = '';
        } else {
            endpointField.readOnly = true;
            endpointField.style.backgroundColor = '#f5f5f5';
        }
    }

    document.getElementById('dialect-anthropic').addEventListener('change', handleDialectChange);
    document.getElementById('dialect-openai').addEventListener('change', handleDialectChange);
    document.getElementById('provider-select').addEventListener('change', handleProviderChange);

    // Profile Management Event Listeners
    document.getElementById('profile-select').addEventListener('change', function() {
        const selectedProfile = this.value;
        loadConfiguration(selectedProfile);
        updateConfigurationUI();
    });

    document.getElementById('edit-profile-btn').addEventListener('click', function() {
        configUIMode = 'edit';
        renderConfigUI();
    });

    document.getElementById('new-profile-btn').addEventListener('click', function() {
        configUIMode = 'create';
        renderConfigUI();
        // Clear the new profile name field in case it had a value
        document.getElementById('new-profile-name').value = '';
    });

    document.getElementById('cancel-profile-btn').addEventListener('click', function() {
        configUIMode = 'view';
        // Reload the active profile to discard any changes
        loadConfiguration(localStorage.getItem('activeProfileName'));
        updateConfigurationUI();
    });

    function getCurrentUIConfig() {
        return {
            apiDialect: document.querySelector('input[name="api-dialect"]:checked').value,
            provider: document.getElementById('provider-select').value,
            endpoint: document.getElementById('custom-endpoint').value,
            model: document.getElementById('model-name').value,
            apiKey: document.getElementById('api-key').value.trim()
        };
    }

    document.getElementById('save-profile-btn').addEventListener('click', function() {
        let profileNameToSave;
        if (configUIMode === 'create') {
            profileNameToSave = document.getElementById('new-profile-name').value.trim();
            if (!profileNameToSave) {
                alert('Please enter a name for the new profile.');
                return;
            }
        } else { // 'edit' mode
            profileNameToSave = document.getElementById('profile-select').value;
        }
        
        const config = getCurrentUIConfig();
        saveConfiguration(config, profileNameToSave);
        
        configUIMode = 'view';
        updateConfigurationUI(); // Refresh UI to show new/updated profile
    });

    document.getElementById('delete-profile-btn').addEventListener('click', function() {
        const selectedProfile = document.getElementById('profile-select').value;
        if (confirm(`Are you sure you want to delete the profile "${selectedProfile}"?`)) {
            deleteConfiguration(selectedProfile);
            updateConfigurationUI();
        }
    });

    // Initialize configuration UI
    updateConfigurationUI();

    document.getElementById('nav-chat').addEventListener('click', async function(e) {
        e.preventDefault();
        this.classList.add('active-tab');
        document.getElementById('nav-tabs').classList.remove('active-tab');
        document.getElementById('nav-organised-tabs').classList.remove('active-tab');
        document.getElementById('nav-configuration').classList.remove('active-tab');

        // Hide tabs list and show chat elements
        document.getElementById('tabs-list').style.display = 'none';
        document.getElementById('organised-tabs').style.display = 'none';
        document.getElementById('chat').style.display = 'block';
        document.getElementById('configuration').style.display = 'none';
    
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
        document.getElementById('nav-configuration').classList.remove('active-tab');

        // Show tabs list and hide other sections
        document.getElementById('tabs-list').style.display = 'block';
        document.getElementById('organised-tabs').style.display = 'none';
        document.getElementById('chat').style.display = 'none';
        document.getElementById('configuration').style.display = 'none';
    });

    document.getElementById('nav-organised-tabs').addEventListener('click', async function(e) {
        e.preventDefault();
        this.classList.add('active-tab');
        document.getElementById('nav-tabs').classList.remove('active-tab');
        document.getElementById('nav-chat').classList.remove('active-tab');
        document.getElementById('nav-configuration').classList.remove('active-tab');

        // Show organised tabs and hide other sections
        document.getElementById('tabs-list').style.display = 'none';
        document.getElementById('organised-tabs').style.display = 'block';
        document.getElementById('chat').style.display = 'none';
        document.getElementById('configuration').style.display = 'none';

        // Show loading state
        document.getElementById('organised-tabs').innerHTML = '<div class="loading">Organizing tabs...</div>';

        // Update with organized view - activeWindowId not needed for organized view
        const currentWindow = await chrome.windows.getCurrent();
        await updateTabsList(true, currentWindow.id);
    });

    document.getElementById('nav-configuration').addEventListener('click', function(e) {
        e.preventDefault();
        this.classList.add('active-tab');
        document.getElementById('nav-tabs').classList.remove('active-tab');
        document.getElementById('nav-chat').classList.remove('active-tab');
        document.getElementById('nav-organised-tabs').classList.remove('active-tab');

        // Show configuration and hide other sections
        document.getElementById('tabs-list').style.display = 'none';
        document.getElementById('organised-tabs').style.display = 'none';
        document.getElementById('chat').style.display = 'none';
        document.getElementById('configuration').style.display = 'block';
    });

});


//send prompt to AI (supports multiple API dialects)
function sendPromptToAI(prompt, context = '', config) {
    const fullPrompt = context ? `${prompt}\n\n${context}` : prompt;

    console.log("sending prompt to AI", {
        prompt: prompt.substring(0, 100) + '...',
        config: config
    });

    if (config.apiDialect === 'anthropic') {
        return sendAnthropicRequest(fullPrompt, config);
    } else {
        return sendOpenAIRequest(fullPrompt, config);
    }
}

function sendAnthropicRequest(prompt, config) {
    return fetch(config.endpoint, {
        method: "POST",
        headers: {
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
            model: config.model,
            max_tokens: 8192,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                    ],
                },
            ],
        }),
    })
    .then((response) => response.json());
}

function sendOpenAIRequest(prompt, config) {
    return fetch(config.endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: config.model,
            max_completion_tokens: 8192,
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
        }),
    })
    .then((response) => response.json());
}

// Helper function to extract response content consistently across API formats
function extractResponseContent(response, config) {
    if (response.error) {
        return { error: response.error };
    }

    if (config.apiDialect === 'anthropic') {
        // Anthropic format: response.content[0].text
        if (response.content && response.content[0] && response.content[0].text) {
            return { content: response.content[0].text };
        }
    } else {
        // OpenAI format: response.choices[0].message.content
        if (response.choices && response.choices[0] && response.choices[0].message) {
            return { content: response.choices[0].message.content };
        }
    }

    return { error: 'Invalid response format' };
}

// UI helper functions
function getSortType() {
    return document.getElementById('sort-by-domain').checked ? 'domain' : 'index';
}

function getSearchTerm() {
    return document.getElementById('tab-search').value.toLowerCase();
}

// Function to update the tabs list
async function updateTabsList(isOrganizedView, activeWindowId) {
    const tabs = await retrieveChromeTabs();
    
    if (isOrganizedView) {
        const organizedTabs = await getOrganizedTabsFromClaude(tabs);
        document.getElementById('organised-tabs').innerHTML = formatOrganizedTabInfo(organizedTabs, tabs);
    } else {
        document.getElementById('tabs-list').innerHTML = formatTabInfo({ tabs, activeWindowId }, getSortType(), getSearchTerm());
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
            const currentWindow = await chrome.windows.getCurrent();
            await updateTabsList(isOrganizedView, currentWindow.id);
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
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    
    let tabsById = {};
    const currentTime = new Date().getTime();
    
    // Create flat structure of tabs indexed by tab ID
    tabs.forEach(tab => {
        let domain = '';
        try {
            domain = new URL(tab.url).hostname;
        } catch (error) {
            console.warn(`Failed to parse URL for tab ${tab.id}:`, error);
        }
        tabsById[tab.id] = {
            url: tab.url,
            title: tab.title,
            domain: domain,
            openDuration: currentTime - tab.lastAccessed,
            index: tab.index,
            active: tab.active,
            id: tab.id,
            windowId: tab.windowId
        };
    });

    return tabsById;
}

// Helper function to check if tabs have changed and update cache for removals
function haveTabsChanged(tabs) {
    if (!tabsCache.tabs) return true;
    
    let hasChanges = false;
    const updatedCategories = {};
    
    // Check each tab in the new tabs for modifications or if it's a new tab
    // Just a removal of a tab is not considered a change
    for (const tabId in tabs) {
        const newTab = tabs[tabId];
        const cachedTab = tabsCache.tabs[tabId];
        
        // If there's a new tab or a tab was modified, that's a change
        if (!cachedTab || 
            newTab.url !== cachedTab.url || 
            newTab.title !== cachedTab.title) {
            return true;
        }
    }
    
    // If we get here, only removals happened (or no changes)
    // Update the categories by removing deleted tabs
    for (const category in tabsCache.categories) {
        const remainingTabIds = tabsCache.categories[category].filter(tabId => {
            return tabs[tabId] !== undefined;
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
        tabsCache.tabs = tabs;
        tabsCache.categories = updatedCategories;
    }
    
    return false;
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
//TODO: getOrganizedTabsFromClaude, haveTabsChanged, queryClaudeForTabs and tabsCache should be moved into its own module
// Add new function to get organized tabs from Claude
async function getOrganizedTabsFromClaude(tabs) {
    // Check if anything changed (and handle removals if that's all that changed)
    if (haveTabsChanged(tabs)) {
        return await queryClaudeForTabs(tabs);
    }

    console.log("Using cached organized tabs");
    return tabsCache.categories;
}

// Helper function to query Claude for new organization
// TODO: Add ability to provide a list of categories as a config option
async function queryClaudeForTabs(tabs) {
    const config = loadConfiguration();
    if (!config.apiKey) {
        alert('Please configure your API key in the Configuration tab first');
        return null;
    }

    // Convert tabs object to array
    let allTabs = Object.values(tabs);

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
        const response = await sendPromptToAI(prompt, '', config);
        const result = extractResponseContent(response, config);

        if (result.error) {
            console.error('AI API Error:', result.error);
            return null;
        }

        // Parse the JSON response from AI (contains only categories and tab IDs)
        const categorizedTabIds = JSON.parse(result.content);

        // Update cache - store only the tabs object and categories
        tabsCache.tabs = tabs;
        tabsCache.categories = categorizedTabIds;
        
        return categorizedTabIds;
    } catch (error) {
        console.error('Error organizing tabs:', error);
        return null;
    }
}