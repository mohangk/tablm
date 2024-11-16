//Globals - don't kill me
const summarizeAchievementsSystemPrompt = ``;

const feedbackSystemPrompt = ``;

var grabberName = '';
var keyAchievementsText = '';

// Starts here
document.addEventListener('DOMContentLoaded', function() {
    console.log("tablm is running");
    retrieveChromeTabs((result) => { updateTabsList(formatTabInfo(result))  ;} );
    //retrieveKeyAchievements((result) => {keyAchievementsText = result.trim(); updateNotification("Key achievements retrieved.");console.log('ka set>>>', keyAchievementsText);} );
    //populateModelList();
    //populateFields();
    //registerSubmitEventListener(); 
    //registerGenerateFeedbackEventListener();
    //registerDisplaySettingsListener();
    //registerCopyTo360Listener();
});
// New function to format tab information
function formatTabInfo(tabInfo) {
    let output = '<ul>';
    
    for (let windowId in tabInfo) {
        output += `<li>Window ${windowId}:<ul>`;
        for (let tabId in tabInfo[windowId]) {
            const tab = tabInfo[windowId][tabId];
            const duration = formatDuration(tab.openDuration);
            output += `<li>
                <div>${tab.title}</div>
                <div><a href="${tab.url}">${tab.url}</a></div>
                <div>Open for: ${duration}</div>
            </li>`;
        }
        output += '</ul></li>';
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

function registerCopyTo360Listener(){
    document.getElementById('copyTo360').addEventListener('click', function(event) {
        const strengths = document.getElementById('strengths').value.trim();
        const growthAreas = document.getElementById('growth-areas').value.trim();
        event.preventDefault();
        populateStrengthsAndGrowths(strengths, growthAreas);
    });
}

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
    document.getElementById('submit').addEventListener('click', function(event) {
        event.preventDefault();
        const systemPrompt = document.getElementById('system-prompt').value.trim()
        saveFields({systemPrompt: systemPrompt});
        fetchAPI(keyAchievementsText, systemPrompt, populateFeedbackRows);
    });
};

function registerGenerateFeedbackEventListener(){
    document.getElementById('generateFeedback').addEventListener('click', function(event) {
        event.preventDefault();
        console.log('generate feedback clicked');

        //check if all fields are empty
        var emptyFields = true;
        document.querySelectorAll('.feedback[data-type="strength"],.feedback[data-type="growth"]').forEach(element => {
            if(element.value.trim()!== '') {
                emptyFields = false;
            }
        });

        if (emptyFields) {
            alert('Please fill some Growth or Strength fields before generating feedback');
            return;
        }

        const feedbackArr = retrieveFeedbacks();
        const feedbackUserPrompt = createFeedbackUserPrompt(grabberName, keyAchievementsText , feedbackArr);
        const fbSystemPrompt = document.getElementById('feedback-system-prompt').value.trim()
        saveFields({feedbackSystemPrompt: fbSystemPrompt});
        fetchAPI(feedbackUserPrompt, feedbackSystemPrompt, (result)=> {
            const { strengthsHTML, growthAreasHTML } = createStrengthsAndGrowthsHTML(result);
            document.getElementById('strengths-growths').style.display = 'block';
            document.getElementById('strengths').innerHTML = strengthsHTML;
            document.getElementById('growth-areas').innerHTML = growthAreasHTML;
        }); 
    });
};

function createStrengthsAndGrowthsHTML(generatedFeedback) {
    const strengthsHTML = generatedFeedback.strengths.join('<br/>');
    const growthAreasHTML = generatedFeedback.growths.join('<br/>');
    return { strengthsHTML, growthAreasHTML };
}

function populateFields(){
    chrome.storage.local.get(['modelType', 'systemPrompt', 'apiKey', 'feedbackSytemPrompt'], function(items) {
        document.getElementById('model-type').value = items.modelType || 'gpt-4';
        document.getElementById('system-prompt').value = items.systemPrompt || summarizeAchievementsSystemPrompt;
        document.getElementById('feedback-system-prompt').value = items.feedbackSystemPrompt || feedbackSystemPrompt;
        document.getElementById('api-key').value = items.apiKey || '';
    });
}
// Prompt generation code
function createFeedbackUserPrompt(name, achievements, feedbackArr) {
    const feedbacks = createFeedbacksPrompt(feedbackArr);
    return `
        <name>
        ${name} 
        </name>

        <achievements> 
        ${achievements}
        </achievements>

        ${feedbacks}
        `;
}

function createFeedbacksPrompt(feedbacks) {
    var feedbacksPrompt = '';
    feedbacks.forEach((feedback)=>{
        if(feedback.strength.trim() =='' && feedback.growth.trim() =='') {
            return; 
        }
        feedbacksPrompt += `<feedback>\n
        Context: ${feedback.context}\n
        Growth:  ${feedback.growth}\n
        Strength: ${feedback.strength}\n
        </feedback>\n
        `;
    });
    return feedbacksPrompt;
}

//Functions to update or retrieve from the the Extension UI
function updateNotification(text, overwrite=false) {
    if(overwrite) {
        document.getElementById('results').textContent = text;
    } else {
        document.getElementById('results').textContent = text + '\n' + document.getElementById('results').textContent;
    }
}

//Functions to update or retrieve from the the Extension UI
function updateTabsList(tabListHTML) {
    document.getElementById('tabs-list').innerHTML = tabListHTML;
}

function retrieveFeedbacks() {
    var feedbackArr = [];
    document.querySelectorAll('.feedback[data-id]').forEach(el => {
        if (feedbackArr[el.dataset.id] == undefined ) {
            feedbackArr[el.dataset.id] = {
                context: '',
                growth: '',
                strength: ''
            }
        }
        feedbackArr[el.dataset.id][el.dataset.type] = el.value;
        //console.log(el.dataset.id, el.dataset.type, el.value);
    });
    return feedbackArr;
};

function createFeedbackRowHTML(id, label, kaSummary) {
    return `
    <div id="ka-feedback-${id}" class="grid">
        <div> <label class="ka-label"> ${label} </label> <textarea data-id="${id}" data-type="context" class="feedback" rows="5" readonly> ${kaSummary}</textarea></div>
        <div><label> Strength </label> <textarea data-id="${id}" class="feedback" data-type="strength" rows="5"> </textarea></div>
        <div><label> Growth </label> <textarea data-id="${id}" class="feedback" data-type="growth" rows="5"> </textarea></div>
    </div>
    `;
}

function populateFeedbackRows(kaSummmaries) {
    const feedbackContainer = document.getElementById('ka-feedback-container');
    feedbackContainer.innerHTML = '';

    kaSummmaries.unshift('General feedback');
    kaSummmaries.forEach((ka, idx) => {
        feedbackContainer.innerHTML += createFeedbackRowHTML(idx, idx, ka)
    });
}


//TODO: add the feedbackSystemPrompt value
function saveFields(fieldProperties){
    chrome.storage.local.set(fieldProperties, function() {
        console.log('Settings saved');
    });
}

// G360 page scraper functions
function setFeedbackTextAreas(strengthsHTML, growthAreasHTML){
    const el1 = document.querySelector('#rich_text_2_feedbackGuide');
    if (el1) {
        el1.remove();
    }
    document.querySelector('#rich_text_2_editor .ql-editor').innerHTML = strengthsHTML;
    const el2 = document.querySelector('#rich_text_3_feedbackGuide');
    if (el2) {
        el2.remove();
    }
    document.querySelector('#rich_text_3_editor .ql-editor').innerHTML = growthAreasHTML;
}

function populateStrengthsAndGrowths(strengthsHTML, growthAreasHTML) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: setFeedbackTextAreas,
          args: [strengthsHTML, growthAreasHTML],
        }, function(results) {
            updateNotification('Feeback populated');
        });
    });
}

function getNameText() {
    const cssSelector = '.UserCard__title___2vsPB';
    const element = document.querySelector(cssSelector);
    return element ? element.innerText : '';
}

function getKeyAchievementsText() {
    const cssSelector = '.TextCard__container___2RuUz';
    const element = document.querySelector(cssSelector);
    return element ? element.innerText : '';
}
//
function retrieveChromeTabs(setFn) {
    chrome.tabs.query({}, function(tabs) {
        let tabInfo = {};
        const currentTime = new Date().getTime();
        
        // Group tabs by windowId
        tabs.forEach(tab => {
            console.log("tab inspect", tab.windowId, tab.id);
            if (!tabInfo[tab.windowId]) {
                tabInfo[tab.windowId] = {};
            }
            tabInfo[tab.windowId][tab.id] = {
                url: tab.url,
                title: tab.title,
                openDuration: currentTime - tab.lastAccessed // time in milliseconds
            };
        });
        setFn(tabInfo);
    });
}

function retrieveKeyAchievements(setKeyAchievementsFn) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: getKeyAchievementsText,
        }, function(results) {
           setKeyAchievementsFn(results[0].result);
        });
    });
}

// Functions that interact with GrabGTP API
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