/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Provides reusable motion business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
/**
 * Lightweight motion compatibility layer.
 *
 * Replaces framer-motion with basic Tailwind CSS animations.
 * Provides motion.div, motion.button, motion.section, etc. as plain elements
 * with CSS animation classes. AnimatePresence is a pass-through wrapper.
 *
 * This avoids having framer-motion as a dependency while keeping the JSX structure intact.
 */

import { forwardRef, createElement, useState, useEffect } from "react";

/**
 * Creates a motion-compatible component that renders a plain HTML element
 * with Tailwind CSS transition/animation classes.
 */
function createMotionComponent(tag) {
  const MotionComponent = forwardRef(function MotionElement(props, ref) {
    const {
      initial,
      animate,
      exit,
      transition,
      variants,
      whileHover,
      whileTap,
      whileInView,
      viewport,
      layout,
      style,
      className = "",
      children,
      ...rest
    } = props;

    // Build animation classes based on common patterns
    let animationClasses = "transition-all duration-500 ease-out";

    // If initial has opacity: 0, add a fade-in via CSS
    const [isVisible, setIsVisible] = useState(!initial);

    useEffect(() => {
      if (initial) {
        // Small delay to trigger CSS transition
        const timer = requestAnimationFrame(() => setIsVisible(true));
        return () => cancelAnimationFrame(timer);
      }
    }, []);

    const visibilityStyle = {};
    if (initial && typeof initial === "object" && initial.opacity !== undefined) {
      visibilityStyle.opacity = isVisible ? 1 : 0;
      visibilityStyle.transform = isVisible ? "translateY(0)" : `translateY(${initial.y || 0}px)`;
    }

    // Hover classes for common patterns
    let hoverClasses = "";
    if (whileHover) {
      if (whileHover.scale) hoverClasses += " hover:scale-[1.03]";
      if (whileHover.y) hoverClasses += " hover:-translate-y-1";
      if (whileHover.rotate) hoverClasses += " hover:rotate-[-4deg]";
    }

    // Tap/active classes
    let activeClasses = "";
    if (whileTap) {
      if (whileTap.scale) activeClasses += " active:scale-[0.98]";
    }

    const combinedClassName = `${animationClasses} ${hoverClasses} ${activeClasses} ${className}`.trim();

    const combinedStyle = { ...style, ...visibilityStyle };

    // Handle animated background/floating elements with CSS animations
    if (animate && typeof animate === "object" && !Array.isArray(animate)) {
      if (animate.backgroundPosition) {
        combinedStyle.animation = "bgShift 16s ease-in-out infinite";
      }
      if (animate.y || animate.x || animate.rotate) {
        combinedStyle.animation = "float 7s ease-in-out infinite";
      }
      if (animate.opacity && Array.isArray(animate.opacity)) {
        combinedStyle.animation = "pulse 2.8s ease-in-out infinite";
      }
    }

    return createElement(tag, {
      ref,
      className: combinedClassName,
      style: combinedStyle,
      ...rest
    }, children);
  });

  MotionComponent.displayName = `motion.${tag}`;
  return MotionComponent;
}

// Proxy-based motion object that creates components on demand
export const motion = new Proxy({}, {
  get(target, prop) {
    if (!target[prop]) {
      target[prop] = createMotionComponent(prop);
    }
    return target[prop];
  }
});

// AnimatePresence is a pass-through — children render/unmount normally
export function AnimatePresence({ children }) {
  return children;
}

// useReducedMotion hook — always returns false (let Tailwind handle prefers-reduced-motion)
export function useReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const handler = (e) => setPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return prefersReduced;
}
