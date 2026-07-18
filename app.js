// Configuration
const GEMINI_API_KEY = 'AQ.Ab8RN6LOBEiu-en-QJ6mIK8jlZKCN1EAuofjAItIUED6Uio-Xg';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';
// State management
let conversations = JSON.parse(localStorage.getItem('conversations')) || [];
let currentConversationId = null;
let isGenerating = false;

// DOM elements
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const newChatBtn = document.getElementById('newChatBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const themeToggle = document.getElementById('themeToggle');
const chatHistory = document.getElementById('chatHistory');
const welcomeMessage = document.getElementById('welcomeMessage');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const rateLimitAlert = document.getElementById('rateLimitAlert');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    loadChatHistory();
    setupEventListeners();
    
    // Load last conversation or show welcome
    if (conversations.length > 0) {
        loadConversation(conversations[0].id);
    }
});

// Theme management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
}

function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Event listeners
function setupEventListeners() {
    // Send message
    sendButton.addEventListener('click', sendMessage);
    
    // Enter to send, Shift+Enter for new line
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Auto-resize textarea and toggle send button
    messageInput.addEventListener('input', () => {
        sendButton.disabled = !messageInput.value.trim();
    });
    
    // New chat
    newChatBtn.addEventListener('click', createNewChat);
    
    // Clear chat
    clearChatBtn.addEventListener('click', clearCurrentChat);
    
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
    
    // Mobile menu toggle
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
    
    // Close sidebar on outside click (mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth < 768 && 
            !sidebar.contains(e.target) && 
            !mobileMenuBtn.contains(e.target) &&
            sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
    });
}

// Chat management
function createNewChat() {
    currentConversationId = null;
    messagesContainer.innerHTML = '';
    messagesContainer.appendChild(welcomeMessage);
    welcomeMessage.style.display = 'flex';
    messageInput.value = '';
    sendButton.disabled = true;
    updateChatHistoryUI();
    
    // Close sidebar on mobile
    if (window.innerWidth < 768) {
        sidebar.classList.remove('active');
    }
}

function clearCurrentChat() {
    if (!currentConversationId) return;
    
    if (confirm('Are you sure you want to clear this chat?')) {
        conversations = conversations.filter(c => c.id !== currentConversationId);
        saveConversations();
        createNewChat();
    }
}

function loadConversation(conversationId) {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;
    
    currentConversationId = conversationId;
    messagesContainer.innerHTML = '';
    welcomeMessage.style.display = 'none';
    
    conversation.messages.forEach(msg => {
        addMessageToUI(msg.role, msg.content, false);
    });
    
    updateChatHistoryUI();
    scrollToBottom();
    
    // Close sidebar on mobile
    if (window.innerWidth < 768) {
        sidebar.classList.remove('active');
    }
}

function saveConversations() {
    localStorage.setItem('conversations', JSON.stringify(conversations));
}

function loadChatHistory() {
    updateChatHistoryUI();
}

function updateChatHistoryUI() {
    chatHistory.innerHTML = '';
    
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = `chat-history-item px-4 py-3 rounded-lg cursor-pointer ${conv.id === currentConversationId ? 'active' : ''}`;
        item.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="truncate flex-1">${conv.title}</span>
                <button class="delete-chat ml-2 opacity-50 hover:opacity-100" data-id="${conv.id}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        `;
        
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-chat')) {
                loadConversation(conv.id);
            }
        });
        
        item.querySelector('.delete-chat').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this conversation?')) {
                conversations = conversations.filter(c => c.id !== conv.id);
                saveConversations();
                if (currentConversationId === conv.id) {
                    createNewChat();
                } else {
                    updateChatHistoryUI();
                }
            }
        });
        
        chatHistory.appendChild(item);
    });
}

// Message handling
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isGenerating) return;
    
    // Hide welcome message
    welcomeMessage.style.display = 'none';
    
    // Create new conversation if needed
    if (!currentConversationId) {
        currentConversationId = Date.now().toString();
        conversations.unshift({
            id: currentConversationId,
            title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
            messages: []
        });
    }
    
    // Add user message
    const conversation = conversations.find(c => c.id === currentConversationId);
    conversation.messages.push({ role: 'user', content: message });
    addMessageToUI('user', message);
    
    // Clear input
    messageInput.value = '';
    sendButton.disabled = true;
    
    // Show typing indicator
    const typingIndicator = showTypingIndicator();
    
    // Get AI response
    isGenerating = true;
    try {
        const response = await getGeminiResponse(conversation.messages);
        typingIndicator.remove();
        
        // Add AI message
        conversation.messages.push({ role: 'assistant', content: response });
        addMessageToUI('assistant', response, true);
        
        saveConversations();
        updateChatHistoryUI();
    } catch (error) {
        typingIndicator.remove();
        
        if (error.message.includes('rate limit') || error.message.includes('429')) {
            showRateLimitAlert();
        } else {
            addMessageToUI('assistant', `Error: ${error.message}. Please try again.`);
        }
    } finally {
        isGenerating = false;
    }
}

async function getGeminiResponse(messages) {
    const formattedMessages = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));
    
   const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
        body: JSON.stringify({
            contents: formattedMessages,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
            }
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
            throw new Error('rate limit exceeded');
        }
        throw new Error(error.error?.message || 'Failed to get response');
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// UI rendering
function addMessageToUI(role, content, animate = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} message-bubble`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = `max-w-[80%] md:max-w-[70%] rounded-2xl px-6 py-4 ${
    role === 'user' 
        ? 'bg-blue-100 text-blue-900 font-medium shadow-sm'
        : 'bg-white dark:bg-dark-input shadow-md'
}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (role === 'assistant') {
        contentDiv.innerHTML = renderMarkdown(content);
        
        if (animate) {
            contentDiv.style.opacity = '0';
            setTimeout(() => {
                contentDiv.style.transition = 'opacity 0.3s';
                contentDiv.style.opacity = '1';
            }, 10);
        }
    } else {
        contentDiv.textContent = content;
    }
    
    bubbleDiv.appendChild(contentDiv);
    
    // Add copy button for AI messages
    if (role === 'assistant') {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'mt-2 flex items-center gap-1 text-xs opacity-50 hover:opacity-100 transition-opacity';
        copyBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
            <span>Copy Chat</span>
        `;
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(content);
            copyBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Copied!</span>
            `;
            setTimeout(() => {
                copyBtn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                    <span>Copy Chat</span>
                `;
            }, 2000);
        });
        bubbleDiv.appendChild(copyBtn);
    }
    
    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);
    
    // Add copy buttons to individual code blocks inside the message
    if (role === 'assistant') {
        addCopyButtonsToCodeBlocks(contentDiv);
    }
    
    scrollToBottom();
}

// Fixed Markdown parsing function to handle Highlight.js safely
function renderMarkdown(text) {
    marked.use({
        breaks: true,
        gfm: true
    });
    
    const parsedHtml = marked.parse(text);
    
    // Use temporary container to process code highlights securely post-parse
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = parsedHtml;
    
    tempDiv.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
    
    return tempDiv.innerHTML;
}

function addCopyButtonsToCodeBlocks(container) {
    const codeBlocks = container.querySelectorAll('pre');
    codeBlocks.forEach(pre => {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'code-copy-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', () => {
            const code = pre.querySelector('code').textContent;
            navigator.clipboard.writeText(code);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
            }, 2000);
        });
        pre.style.position = 'relative';
        pre.appendChild(copyBtn);
    });
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'flex justify-start message-bubble';
    indicator.innerHTML = `
        <div class="bg-white dark:bg-dark-input rounded-2xl px-6 py-4 shadow-md">
            <div class="flex gap-1">
                <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(indicator);
    scrollToBottom();
    return indicator;
}

function showRateLimitAlert() {
    rateLimitAlert.classList.remove('translate-x-full');
    setTimeout(() => {
        rateLimitAlert.classList.add('translate-x-full');
    }, 5000);
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
