mergeInto(LibraryManager.library, {
    // 1. Open a blank window immediately on the exact click frame so the browser doesn't block it
    OpenBlankXamanPopup: function () {
        if (!window.xamanWindowRef || window.xamanWindowRef.closed) {
            window.xamanWindowRef = window.open('about:blank', '_blank', 'noopener,noreferrer');
        }
        
        // Listen for the cross-window completion postMessage from Vercel
        if (!window.xamanListenerAttached) {
            window.addEventListener('message', function(event) {
                if (event.data === 'XAMAN_LOGIN_SUCCESS') {
                    console.log('Strict popup completion signal intercepted.');
                }
            }, false);
            window.xamanListenerAttached = true;
        }
    },

    // 2. Safely redirect that already-opened window to your Xaman sign-in page
    RedirectXamanPopup: function (urlStr) {
        var targetUrl = UTF8ToString(urlStr);
        if (window.xamanWindowRef && !window.xamanWindowRef.closed) {
            window.xamanWindowRef.location.href = targetUrl;
        } else {
            // Fallback if the user closed the blank tab prematurely before Vercel responded
            window.xamanWindowRef = window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
    }
});
