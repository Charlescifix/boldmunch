// Image optimization utilities for Bold Munch
class ImageOptimizer {
  constructor() {
    this.observer = null;
    this.loadedImages = new Set();
  }

  // Initialize lazy loading for images
  initLazyLoading() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !this.loadedImages.has(entry.target)) {
            this.loadImage(entry.target);
            this.observer.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: '50px',
        threshold: 0.1
      });

      // Observe all lazy-loaded images
      document.querySelectorAll('img[loading="lazy"]').forEach(img => {
        this.observer.observe(img);
      });
    }
  }

  // Load image with fade-in effect
  loadImage(img) {
    if (this.loadedImages.has(img)) return;
    
    img.classList.add('lazy-load');
    
    const tempImg = new Image();
    tempImg.onload = () => {
      img.src = tempImg.src;
      img.classList.add('loaded');
      this.loadedImages.add(img);
    };
    
    tempImg.onerror = () => {
      img.alt = 'Image failed to load';
      img.style.backgroundColor = 'var(--cream)';
      this.loadedImages.add(img);
    };
    
    tempImg.src = img.dataset.src || img.src;
  }

  // Preload critical images
  preloadCriticalImages() {
    const criticalImages = [
      'new_logo.png',
      'Classic banana bread.jpg',
      'Double Chocolate Bread.jpg',
      'Nutella Bread 2.jpg'
    ];

    criticalImages.forEach(src => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);
    });
  }

  // Create responsive image source set
  createResponsiveImage(baseName, sizes = [320, 640, 1280]) {
    const extension = baseName.split('.').pop();
    const name = baseName.replace(`.${extension}`, '');
    
    return sizes.map(size => `${name}_${size}w.${extension} ${size}w`).join(', ');
  }

  // Optimize image loading performance
  optimizeImageLoading() {
    // Add image decode attribute for faster rendering
    document.querySelectorAll('img').forEach(img => {
      if (!img.hasAttribute('decoding')) {
        img.decoding = 'async';
      }
    });

    // Preload critical images
    this.preloadCriticalImages();
    
    // Initialize lazy loading
    this.initLazyLoading();
  }
}

// Initialize image optimizer when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const optimizer = new ImageOptimizer();
    optimizer.optimizeImageLoading();
  });
} else {
  const optimizer = new ImageOptimizer();
  optimizer.optimizeImageLoading();
}

export default ImageOptimizer;