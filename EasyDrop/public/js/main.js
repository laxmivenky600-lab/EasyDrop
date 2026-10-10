
// ─── Mobile Menu Toggle ───────────────────────────────────────────────────
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const navMenuWrapper = document.getElementById('nav-menu-wrapper');
if (mobileMenuBtn && navMenuWrapper) {
    mobileMenuBtn.addEventListener('click', () => {
        const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
        mobileMenuBtn.setAttribute('aria-expanded', !isExpanded);
        navMenuWrapper.classList.toggle('active');
        
        const iconMenu = mobileMenuBtn.querySelector('.icon-menu');
        const iconClose = mobileMenuBtn.querySelector('.icon-close');
        if (isExpanded) {
            if (iconMenu) iconMenu.style.display = 'block';
            if (iconClose) iconClose.style.display = 'none';
        } else {
            if (iconMenu) iconMenu.style.display = 'none';
            if (iconClose) iconClose.style.display = 'block';
        }
    });

    // Close menu when clicking a link
    navMenuWrapper.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
            navMenuWrapper.classList.remove('active');
            const iconMenu = mobileMenuBtn.querySelector('.icon-menu');
            const iconClose = mobileMenuBtn.querySelector('.icon-close');
            if (iconMenu) iconMenu.style.display = 'block';
            if (iconClose) iconClose.style.display = 'none';
        });
    });
}

// ─── Smooth in-page scroll for hash anchors ───────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
    });
});

// ─── Footer scroll links (work on any page) ───────────────────────────────
// Links with class "footer-scroll-link" carry a data-section attribute.
// If we are already on the homepage we scroll; otherwise we navigate there
// with the hash so the browser auto-scrolls after load.
document.querySelectorAll('.footer-scroll-link').forEach(link => {
    link.addEventListener('click', function (e) {
        const sectionId = this.dataset.section;
        const target = document.getElementById(sectionId);
        if (target) {
            // We're on the homepage — scroll smoothly.
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        }
        // Otherwise fall through: the href already points to /#section
        // so the browser navigates to the homepage and the hash does the rest.
    });
});

// ─── Dynamic copyright year ───────────────────────────────────────────────
const yearEl = document.getElementById('footer-year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ─── Back-to-top button ───────────────────────────────────────────────────
const backToTop = document.getElementById('back-to-top');
if (backToTop) {
    // Show after scrolling 320 px
    const onScroll = () => {
        backToTop.classList.toggle('visible', window.scrollY > 320);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // run once in case page is already scrolled

    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ─── Footer Animated Text Hover ───────────────────────────────────────────
const footerAnimWrapper = document.getElementById('footer-anim-wrapper');
const footerRevealCircle = document.getElementById('footer-reveal-circle');

if (footerAnimWrapper && footerRevealCircle) {
    if (window.matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)').matches) {
        footerAnimWrapper.addEventListener('mousemove', (e) => {
            const rect = footerAnimWrapper.getBoundingClientRect();
            let x = ((e.clientX - rect.left) / rect.width) * 100;
            let y = ((e.clientY - rect.top) / rect.height) * 100;
            
            x = Math.max(0, Math.min(100, x));
            y = Math.max(0, Math.min(100, y));

            footerRevealCircle.setAttribute('cx', `${x}%`);
            footerRevealCircle.setAttribute('cy', `${y}%`);
            footerRevealCircle.setAttribute('r', `20%`);
        });

        footerAnimWrapper.addEventListener('mouseleave', () => {
            footerRevealCircle.setAttribute('r', `0`);
        });
    } else {
        // Mobile or reduced motion fallback
        footerRevealCircle.setAttribute('cx', `50%`);
        footerRevealCircle.setAttribute('cy', `50%`);
        footerRevealCircle.setAttribute('r', `100%`);
    }
}
