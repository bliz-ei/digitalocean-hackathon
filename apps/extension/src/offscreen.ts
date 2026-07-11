chrome.runtime.onMessage.addListener(message=>{if(message.type==="SESSION_STATE")void chrome.storage.session.set({sessionState:message.payload});});
