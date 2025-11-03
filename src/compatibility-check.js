// src/compatibility-check.js
(function() {
    'use strict';

    /**
     * Restored all original feature checks.
     * Checks for a set of modern browser features.
     * @returns {string[]} An array of warning messages for unsupported features.
     */
    function runFeatureChecks() {
        const warningMessages = [];
        const testEl = document.createElement('div');

        // Check 1: backdrop-filter (for modal blur effect)
        if (!('backdropFilter' in testEl.style || 'webkitBackdropFilter' in testEl.style)) {
            warningMessages.push("弹窗背景的模糊效果无法呈现。");
        }

        // Check 2: gap property in Flexbox
        testEl.style.display = 'flex';
        testEl.style.gap = '1px';
        document.body.appendChild(testEl);
        if (getComputedStyle(testEl).gap !== '1px') {
            warningMessages.push("页面元素之间的间距可能显示错位。");
        }
        document.body.removeChild(testEl);

        // Check 3: color-mix()
        if (typeof CSS === 'undefined' || !CSS.supports('background-color', 'color-mix(in srgb, red, blue)')) {
            warningMessages.push("部分元素的颜色可能无法正确显示。");
        }
        
        // Check 4: CSS Grid
        if (typeof CSS === 'undefined' || !CSS.supports('display', 'grid')) {
            warningMessages.push("部分列表布局可能无法正常渲染。");
        }
        
        // Check 5: prefers-color-scheme media query
        if (!window.matchMedia || !window.matchMedia('(prefers-color-scheme: dark)').matches && !window.matchMedia('(prefers-color-scheme: light)').matches) {
            warningMessages.push("无法根据您的系统设置自动切换浅色/深色模式。");
        }
        
        // Check 6: Service Worker (for PWA/offline capabilities)
        if (!('serviceWorker' in navigator)) {
            warningMessages.push("应用无法离线使用或进行后台自动更新。");
        }
        
        // Check 7: AbortController (for cancelling requests)
        if (typeof window.AbortController === 'undefined') {
            warningMessages.push("无法取消正在进行的网络请求，可能导致操作延迟。");
        }

        return warningMessages;
    }

    /**
     * Loads and displays the warning modal in a way that prevents FOUC.
     * @param {string[]} messages - The list of warning messages to display.
     */
    async function displayWarning(messages) {
        // Create a wrapper container, initially hidden, to inject resources into.
        const modalContainer = document.createElement('div');
        modalContainer.id = 'modal-container-wrapper';
        modalContainer.style.display = 'none';
        document.body.appendChild(modalContainer);

        try {
            // Fetch CSS and HTML text in parallel.
            const [cssResponse, htmlResponse] = await Promise.all([
                fetch('/src/browser-warning.css'),
                fetch('/browser-warning-modal.html')
            ]);

            if (!cssResponse.ok || !htmlResponse.ok) {
                throw new Error('Failed to fetch modal resources.');
            }

            const cssText = await cssResponse.text();
            const htmlText = await htmlResponse.text();

            // 1. Inject CSS into a <style> tag in the <head>.
            // This ensures styles are ready before the HTML is rendered.
            const style = document.createElement('style');
            style.textContent = cssText;
            document.head.appendChild(style);
            
            // 2. Inject the HTML into our hidden container.
            modalContainer.innerHTML = htmlText;

            // Query for elements now that they are in the DOM.
            const browserWarningModal = document.getElementById('browser-warning-modal');
            const browserWarningMessage = document.getElementById('browser-warning-message');
            const browserWarningOkBtn = document.getElementById('browser-warning-ok-btn');
            const browserWarningCloseBtn = document.getElementById('browser-warning-close-btn');
            const dontShowAgainCheckbox = document.getElementById('dont-show-again-checkbox');

            if (!browserWarningModal) return;

            // Populate the message content.
            const fullMessage = '我们检测到您当前的浏览器版本较低，继续使用可能会遇到以下情况：\n\n• ' + messages.join('\n• ');
            browserWarningMessage.textContent = fullMessage;
            
            // 3. Make the wrapper visible. The modal is still hidden by its own CSS.
            modalContainer.style.display = '';

            // 4. Use requestAnimationFrame to apply the 'show' class in the next paint cycle.
            // This guarantees the transition animation will trigger correctly.
            requestAnimationFrame(() => {
                browserWarningModal.classList.add('show');
            });
            
            const hide = () => {
                if (dontShowAgainCheckbox.checked) {
                    try {
                        localStorage.setItem('suppressBrowserWarning', 'true');
                    } catch (e) {
                        console.error('Failed to set localStorage item:', e);
                    }
                }
                browserWarningModal.classList.remove('show');
                // Clean up the DOM after the transition ends.
                browserWarningModal.addEventListener('transitionend', () => {
                    modalContainer.remove();
                    style.remove(); // Also remove the injected style
                }, { once: true });
            };

            browserWarningOkBtn.addEventListener('click', hide);
            browserWarningCloseBtn.addEventListener('click', hide);
            browserWarningModal.addEventListener('click', (e) => {
                if (e.target === browserWarningModal) hide();
            });

        } catch (error) {
            console.error('Failed to display browser warning:', error);
            // Ensure the container is removed if an error occurs.
            if (modalContainer) modalContainer.remove();
        }
    }

    /**
     * Initializes the compatibility check.
     */
    function initialize() {
        if (localStorage.getItem('suppressBrowserWarning') === 'true') {
            return;
        }
        
        const warningMessages = runFeatureChecks();
        if (warningMessages.length > 0) {
            displayWarning(warningMessages);
        }
    }

    // Defer initialization until the DOM is ready.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
