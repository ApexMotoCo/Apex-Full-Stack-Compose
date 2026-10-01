/**
 * main.js
 * Global JavaScript file for Apex Moto Competitions
 */

document.addEventListener("DOMContentLoaded", function() {
    
    /**
     * GDPR Cookie Consent Banner
     */
    var banner = document.getElementById('site-prefs-banner');
    var acceptBtn = document.getElementById('accept-prefs');
    var declineBtn = document.getElementById('decline-prefs');

    if (banner && acceptBtn && declineBtn) {

        acceptBtn.addEventListener('click', function() {
            localStorage.setItem('cookieConsent', 'accepted');
            banner.style.display = 'none';
        });

        declineBtn.addEventListener('click', function() {
            localStorage.setItem('cookieConsent', 'declined');
            banner.style.display = 'none';
        });
    }

    /**
     * Global helper to check for cookie consent.
     * Use this to wrap tracking scripts (e.g. Google Analytics)
     * Example: if (window.hasCookieConsent()) { loadAnalytics(); }
     */
    window.hasCookieConsent = function() {
        return localStorage.getItem('cookieConsent') === 'accepted';
    };
});
