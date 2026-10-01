// Burger Menu Toggle - Mobile Navigation
(function() {
    function init() {
        var mobileMenu = document.getElementById('mobile-menu');
        var navLinks = document.querySelector('.nav-links');

        if (!mobileMenu || !navLinks) {
            console.error('Menu elements not found');
            return;
        }

        function closeMenu() {
            mobileMenu.classList.remove('is-active');
            navLinks.classList.remove('active');
            document.body.classList.remove('menu-open');
            mobileMenu.setAttribute('aria-expanded', 'false');
        }

        function openMenu() {
            mobileMenu.classList.add('is-active');
            navLinks.classList.add('active');
            document.body.classList.add('menu-open');
            mobileMenu.setAttribute('aria-expanded', 'true');
        }

        mobileMenu.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (navLinks.classList.contains('active')) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && navLinks.classList.contains('active')) {
                closeMenu();
                mobileMenu.focus();
            }
        });

        var allLinks = navLinks.querySelectorAll('a');
        for (var i = 0; i < allLinks.length; i++) {
            allLinks[i].addEventListener('click', function() {
                setTimeout(closeMenu, 100);
            });
        }

        document.addEventListener('click', function(e) {
            if (navLinks.classList.contains('active') &&
                !e.target.closest('.nav-links') &&
                !e.target.closest('.menu-toggle')) {
                closeMenu();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
