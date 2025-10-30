(function() {
    'use strict';

    // DOM元素变量将在资源加载后被赋值
    let browserWarningModal = null;
    let browserWarningMessage = null;
    let browserWarningOkBtn = null;
    let browserWarningCloseBtn = null;
    let dontShowAgainCheckbox = null;

    /**
     * 动态加载弹窗所需的CSS和HTML资源。
     * @returns {Promise<void>}
     */
    function loadModalResources() {
        // 使用Promise.all并行加载CSS和HTML
        return Promise.all([
            // 1. 加载CSS
            new Promise((resolve, reject) => {
                // 如果CSS已加载，则直接成功
                if (document.querySelector('link[href="/src/browser-warning.css"]')) {
                    resolve();
                    return;
                }
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = '/src/browser-warning.css';
                link.onload = resolve;
                link.onerror = () => reject(new Error('Failed to load browser-warning.css'));
                document.head.appendChild(link);
            }),
            // 2. 加载HTML
            new Promise(async (resolve, reject) => {
                // 如果HTML已注入，则直接成功
                if (document.getElementById('browser-warning-modal')) {
                    resolve();
                    return;
                }
                try {
                    const response = await fetch('/browser-warning-modal.html');
                    if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                    const html = await response.text();
                    document.body.insertAdjacentHTML('beforeend', html);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            })
        ]);
    }

    /**
     * 获取弹窗相关的DOM元素引用。
     */
    function queryModalElements() {
        browserWarningModal = document.getElementById('browser-warning-modal');
        if (browserWarningModal) {
            browserWarningMessage = document.getElementById('browser-warning-message');
            browserWarningOkBtn = document.getElementById('browser-warning-ok-btn');
            browserWarningCloseBtn = document.getElementById('browser-warning-close-btn');
            dontShowAgainCheckbox = document.getElementById('dont-show-again-checkbox');
            return true;
        }
        return false;
    }

    function runFeatureChecks() {
        const warningMessages = [];
        const testEl = document.createElement('div');
        if (!('backdropFilter' in testEl.style || 'webkitBackdropFilter' in testEl.style)) warningMessages.push("弹窗背景的模糊效果无法呈现。");
        testEl.style.display = 'flex';
        testEl.style.gap = '1px';
        document.body.appendChild(testEl);
        if (getComputedStyle(testEl).gap !== '1px') warningMessages.push("页面元素之间的间距可能显示错位。");
        document.body.removeChild(testEl);
        if (typeof CSS === 'undefined' || !CSS.supports('background-color', 'color-mix(in srgb, red, blue)')) warningMessages.push("部分元素的颜色可能无法正确显示。");
        if (typeof CSS === 'undefined' || !CSS.supports('display', 'grid')) warningMessages.push("部分列表布局可能无法正常渲染。");
        if (!window.matchMedia || !window.matchMedia('(prefers-color-scheme: dark)').matches && !window.matchMedia('(prefers-color-scheme: light)').matches) warningMessages.push("无法根据您的系统设置自动切换浅色/深色模式。");
        if (!('serviceWorker' in navigator)) warningMessages.push("应用无法离线使用或进行后台自动更新。");
        if (typeof window.AbortController === 'undefined') warningMessages.push("无法取消正在进行的网络请求，可能导致操作延迟。");
        return warningMessages;
    }

    function showBrowserWarningDialog(messages) {
        if (!browserWarningModal || messages.length === 0) return;
        const fullMessage = '我们检测到您当前的浏览器版本较低，继续使用可能会遇到以下情况：\n\n• ' + messages.join('\n• ');
        browserWarningMessage.textContent = fullMessage;
        dontShowAgainCheckbox.checked = false;
        const show = () => browserWarningModal.classList.add('show');
        const hide = () => {
            if (dontShowAgainCheckbox.checked) {
                try {
                    localStorage.setItem('suppressBrowserWarning', 'true');
                } catch (e) {
                    console.error('Failed to set localStorage item:', e);
                }
            }
            browserWarningModal.classList.remove('show');
            browserWarningOkBtn.removeEventListener('click', hide);
            browserWarningCloseBtn.removeEventListener('click', hide);
            browserWarningModal.removeEventListener('click', handleOverlayClick);
        };
        const handleOverlayClick = (e) => {
            if (e.target === browserWarningModal) hide();
        };
        browserWarningOkBtn.addEventListener('click', hide);
        browserWarningCloseBtn.addEventListener('click', hide);
        browserWarningModal.addEventListener('click', handleOverlayClick);
        show();
    }

    async function initialize() {
        if (localStorage.getItem('suppressBrowserWarning') === 'true') {
            return;
        }
        const warningMessages = runFeatureChecks();
        if (warningMessages.length > 0) {
            try {
                await loadModalResources();
                if (queryModalElements()) {
                    showBrowserWarningDialog(warningMessages);
                }
            } catch (error) {
                console.error('Failed to load and display browser warning dialog:', error);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();