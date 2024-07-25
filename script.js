let currentChatId = null;
let chatHistory = [];
let isChatTitleGenerated = false;
let isAssistantResponding = false;
let controller = null;

function startNewChat() {
  currentChatId = Date.now().toString();
  document.getElementById("chatArea").innerHTML = "";
  document.getElementById("chatTitle").textContent = "AI Assistant";
  isChatTitleGenerated = false;
  hideRegenerateButton();
  updateChatHistory();
}

function updateChatHistory() {
  const chatHistoryEl = document.getElementById("chatHistory");
  chatHistoryEl.innerHTML = "";
  chatHistory.forEach((chat, index) => {
    const li = document.createElement("li");
    const chatTitle = document.createElement("span");
    chatTitle.textContent = chat.title || `Chat ${index + 1}`;
    chatTitle.onclick = () => loadChat(chat.id);
    li.appendChild(chatTitle);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "delete-btn";
    deleteBtn.onclick = (event) => {
      event.stopPropagation();
      if (deleteBtn.classList.contains("confirm")) {
        deleteChat(chat.id, li);
      } else {
        deleteBtn.textContent = "Sure?";
        deleteBtn.classList.add("confirm");
        setTimeout(() => {
          deleteBtn.textContent = "Delete";
          deleteBtn.classList.remove("confirm");
        }, 2000);
      }
    };
    li.appendChild(deleteBtn);

    chatHistoryEl.appendChild(li);
  });
}

function deleteChat(chatId, listItem) {
  listItem.style.animation = "deleteAnimation 0.5s forwards";
  setTimeout(() => {
    chatHistory = chatHistory.filter((chat) => chat.id !== chatId);
    updateChatHistory();
    if (currentChatId === chatId) {
      startNewChat();
    }
  }, 500);
}

function loadChat(chatId) {
  currentChatId = chatId;
  const chat = chatHistory.find((c) => c.id === chatId);
  const chatArea = document.getElementById("chatArea");
  chatArea.innerHTML = "";
  document.getElementById("chatTitle").textContent =
    chat.title || "AI Assistant";
  chat.messages.forEach((msg) => {
    appendMessage(msg.role, msg.content, msg.timestamp);
  });
}

function appendMessage(role, content, timestamp = new Date().toLocaleString()) {
  const chatArea = document.getElementById("chatArea");
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${
    role === "user" ? "user-message" : "bot-message"
  }`;

  const iconDiv = document.createElement("div");
  iconDiv.className = "profile-icon";
  iconDiv.style.backgroundImage = `url('${
    role === "user"
      ? "https://i.imgur.com/6VBx3io.png"
      : "https://i.imgur.com/EN1RnD2.png"
  }')`;

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  contentDiv.innerHTML = DOMPurify.sanitize(marked.parse(content));

  const timestampDiv = document.createElement("div");
  timestampDiv.className = "timestamp";
  timestampDiv.textContent = timestamp;

  messageDiv.appendChild(iconDiv);
  messageDiv.appendChild(contentDiv);
  contentDiv.appendChild(timestampDiv);

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy";
  copyBtn.className = "copy-btn";
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(content);
    showNotification("Message copied to clipboard!");
  };
  contentDiv.appendChild(copyBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.className = "delete-msg-btn";
  deleteBtn.onclick = () => {
    messageDiv.remove();
    // Update chat history
    const chat = chatHistory.find((c) => c.id === currentChatId);
    if (chat) {
      chat.messages = chat.messages.filter((m) => m.content !== content);
    }
  };
  contentDiv.appendChild(deleteBtn);

  chatArea.appendChild(messageDiv);
  chatArea.scrollTop = chatArea.scrollHeight;

  if (role === "assistant") {
    showRegenerateButton();
  }
}

function showRegenerateButton() {
  const regenerateBtn = document.getElementById("regenerateBtn");
  regenerateBtn.classList.add("visible");
}

function hideRegenerateButton() {
  const regenerateBtn = document.getElementById("regenerateBtn");
  regenerateBtn.classList.remove("visible");
}

async function updateTitleWithAnimation(title) {
  const chatTitleElement = document.getElementById("chatTitle");
  chatTitleElement.textContent = "";
  for (let i = 0; i < title.length; i++) {
    chatTitleElement.textContent += title[i];
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function sendMessage(isRegenerating = false) {
  const userInput = document.getElementById("userInput");
  const sendButton = document.getElementById("sendButton");
  const regenerateBtn = document.getElementById("regenerateBtn");

  if (userInput.value.trim() !== "" || isRegenerating) {
    if (!currentChatId) {
      startNewChat();
    }

    if (!isRegenerating) {
      const timestamp = new Date().toLocaleString();
      appendMessage("user", userInput.value, timestamp);

      let currentChat = chatHistory.find((c) => c.id === currentChatId);
      if (!currentChat) {
        currentChat = { id: currentChatId, messages: [], title: null };
        chatHistory.push(currentChat);
      }
      currentChat.messages.push({
        role: "user",
        content: userInput.value,
        timestamp
      });
    }

    userInput.value = "";
    userInput.disabled = true;
    sendButton.disabled = true;
    sendButton.classList.add("loading");
    regenerateBtn.disabled = true;

    isAssistantResponding = true;

    try {
      controller = new AbortController();
      const signal = controller.signal;

      const response = await fetch(
        "https://fresedgpt.space/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer fresed-UPz9eYX2xCD1YWKlOqPPDhmspUd0A9"
          },
          body: JSON.stringify({
            messages: chatHistory.find((c) => c.id === currentChatId).messages,
            model: "claude-3-5-sonnet-20240620",
            stream: true
          }),
          signal: signal
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let botReply = "";
      const botMessageDiv = document.createElement("div");
      botMessageDiv.className = "message bot-message";
      const botIcon = document.createElement("div");
      botIcon.className = "profile-icon";
      botIcon.style.backgroundImage = "url('https://i.imgur.com/EN1RnD2.png')";

      const botContentDiv = document.createElement("div");
      botContentDiv.className = "message-content";

      botMessageDiv.appendChild(botIcon);
      botMessageDiv.appendChild(botContentDiv);
      document.getElementById("chatArea").appendChild(botMessageDiv);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        const parsedLines = lines
          .map((line) => line.replace(/^data: /, "").trim())
          .filter((line) => line !== "" && line !== "[DONE]")
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch (error) {
              console.warn("Failed to parse line:", line, error);
              return null;
            }
          })
          .filter((line) => line !== null);

        for (const parsedLine of parsedLines) {
          if (
            parsedLine &&
            parsedLine.choices &&
            parsedLine.choices[0] &&
            parsedLine.choices[0].delta
          ) {
            const { content } = parsedLine.choices[0].delta;
            if (content) {
              botReply += content;
              botContentDiv.innerHTML = DOMPurify.sanitize(
                marked.parse(botReply)
              );
              document.getElementById(
                "chatArea"
              ).scrollTop = document.getElementById("chatArea").scrollHeight;
            }
          }
        }
      }

      const botTimestamp = document.createElement("div");
      botTimestamp.className = "timestamp";
      botTimestamp.textContent = new Date().toLocaleString();
      botContentDiv.appendChild(botTimestamp);

      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy";
      copyBtn.className = "copy-btn";
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(botReply);
        showNotification("Message copied to clipboard!");
      };
      botContentDiv.appendChild(copyBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.className = "delete-msg-btn";
      deleteBtn.onclick = () => {
        botMessageDiv.remove();
        // Update chat history
        const chat = chatHistory.find((c) => c.id === currentChatId);
        if (chat) {
          chat.messages = chat.messages.filter((m) => m.content !== botReply);
        }
      };
      botContentDiv.appendChild(deleteBtn);

      chatHistory
        .find((c) => c.id === currentChatId)
        .messages.push({
          role: "assistant",
          content: botReply,
          timestamp: new Date().toLocaleString()
        });

      if (!isChatTitleGenerated) {
        const titleResponse = await fetch(
          "https://fresedgpt.space/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer fresed-UPz9eYX2xCD1YWKlOqPPDhmspUd0A9"
            },
            body: JSON.stringify({
              messages: [
                {
                  role: "system",
                  content:
                    "Generate a short title (5 words max) for this conversation based on the user's first message."
                },
                {
                  role: "user",
                  content: chatHistory.find((c) => c.id === currentChatId)
                    .messages[0].content
                }
              ],
              model: "claude-3-haiku-20240307",
              max_tokens: 20,
              temperature: 0.1
            })
          }
        );

        const titleData = await titleResponse.json();
        const generatedTitle = titleData.choices[0].message.content.trim();
        const limitedTitle = generatedTitle.split(" ").slice(0, 16).join(" ");
        chatHistory.find((c) => c.id === currentChatId).title = limitedTitle;
        await updateTitleWithAnimation(limitedTitle);
        isChatTitleGenerated = true;
      }

      updateChatHistory();
      showRegenerateButton();
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Fetch aborted");
      } else {
        console.error("Error:", error);
        appendMessage(
          "bot",
          "I apologize, but I'm having trouble connecting. Please try again later."
        );
      }
    } finally {
      isAssistantResponding = false;
      sendButton.classList.remove("loading");
      userInput.disabled = false;
      sendButton.disabled = false;
      regenerateBtn.disabled = false;
      userInput.focus();
    }
  }
}

function showSettings() {
  // Implement settings functionality here
  console.log("Settings button clicked");
}

function regenerateResponse() {
  const chatArea = document.getElementById("chatArea");
  const lastBotMessage = chatArea.querySelector(".bot-message:last-of-type");
  if (lastBotMessage) {
    lastBotMessage.remove();
    // Remove the last assistant message from chat history
    const chat = chatHistory.find((c) => c.id === currentChatId);
    if (chat) {
      chat.messages.pop();
    }
    // Trigger the assistant to respond again
    sendMessage(true);
  }
}

function showNotification(message) {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.classList.add("visible");
  setTimeout(() => {
    notification.classList.remove("visible");
  }, 3000);
}

document
  .getElementById("userInput")
  .addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });

document.getElementById("sendButton").addEventListener("click", function () {
  if (isAssistantResponding) {
    controller.abort();
    isAssistantResponding = false;
    this.classList.remove("loading");
    showNotification("Response stopped");
  } else {
    sendMessage();
  }
});

document.getElementById("sendButton").addEventListener("click", function () {
  if (isAssistantResponding) {
    controller.abort();
    isAssistantResponding = false;
    this.classList.remove("loading");
    showNotification("Response stopped");
  } else {
    sendMessage();
  }
});

startNewChat();
