import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  faArrowLeft,
  faArrowPointer,
  faArrowRight,
  faCircleQuestion,
} from "@fortawesome/free-solid-svg-icons";
import AppIcon from "./AppIcon";

const TOUR_STORAGE_KEY = "dhaka_pharmacy_tour_v1";
const SPOTLIGHT_PADDING = 8;

const getTourSteps = (isAdmin) => [
  {
    path: "/",
    target: '[data-tour="dashboard-sample"]',
    eyebrow: "YOUR QUICK TOUR",
    title: "Explore the sample dashboard",
    body: "Sample data is turned on for this walkthrough so the dashboard is ready to explore. Use the highlighted control to return to live data. Nothing in the database has been changed.",
    enter: "enable-sample-preview",
  },
  {
    path: "/",
    target: '[data-tour="dashboard-charts"]',
    eyebrow: "AT-A-GLANCE INSIGHTS",
    title: "Explore inventory and sales trends",
    body: "The charts summarize stock health and recent sales. Hover, focus, or tap chart details to inspect the values.",
  },
  {
    path: "/medicines",
    target: '[data-tour="medicine-add"]',
    eyebrow: "INVENTORY CATALOG",
    title: "Manage medicines and batches",
    body: "Browse the alphabetical medicine list, track separate batches and expiry dates, or use RxNorm suggestions when adding a medicine.",
  },
  {
    path: "/billing",
    target: '[data-tour="billing-search"]',
    eyebrow: "DAILY WORKFLOW",
    title: "Build a bill without processing it",
    body: "Search the catalog and add eligible stock to a draft cart. This tour does not submit a bill or change inventory.",
  },
  {
    path: "/sales",
    target: '[data-tour="sales-summary"]',
    eyebrow: "TRANSACTION HISTORY",
    title: "Review and filter sales",
    body: "Use the date filters to find recorded transactions and inspect their details. Return actions are available from the history when needed.",
  },
  ...(isAdmin
    ? [
        {
          path: "/reports",
          target: '[data-tour="reports-preview"]',
          eyebrow: "ADMIN ANALYTICS",
          title: "Finish with reports",
          body: "Review revenue, profit, refunds, and trends over a selected period. The report's sample preview is illustrative and cannot be exported as actual data.",
        },
      ]
    : []),
];

const readTourStatus = () => {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY);
  } catch {
    return null;
  }
};

const saveTourStatus = (status) => {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, status);
  } catch {
    // The tour remains usable if browser storage is unavailable.
  }
};

const isReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;

export default function GuidedTour({ user, pathname, navigate }) {
  const isAdmin = user?.role === "admin" || user?.role === "main_admin";
  const steps = useMemo(() => getTourSteps(isAdmin), [isAdmin]);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState(null);
  const [cardPosition, setCardPosition] = useState({
    top: 16,
    left: 16,
    placement: "below",
    tailLeft: 32,
  });
  const cardRef = useRef(null);
  const welcomeRef = useRef(null);
  const launcherRef = useRef(null);
  const nextButtonRef = useRef(null);
  const enteredStepsRef = useRef(new Set());

  useEffect(() => {
    if (!user || readTourStatus()) return undefined;
    const timer = window.setTimeout(() => setWelcomeOpen(true), 500);
    return () => window.clearTimeout(timer);
  }, [user]);

  const finishTour = useCallback((status = "completed") => {
    saveTourStatus(status);
    setActive(false);
    setSpotlight(null);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

  const startTour = () => {
    enteredStepsRef.current = new Set();
    setWelcomeOpen(false);
    setStepIndex(0);
    setSpotlight(null);
    setActive(true);
    if (pathname !== "/") navigate("/");
  };

  const dismissWelcome = () => {
    saveTourStatus("dismissed");
    setWelcomeOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  };

  useEffect(() => {
    if (!active) return undefined;
    const step = steps[stepIndex];
    if (!step) {
      finishTour();
      return undefined;
    }
    if (pathname !== step.path) {
      navigate(step.path);
      return undefined;
    }

    let disposed = false;
    let attempts = 0;
    let timer;
    let animationFrame;

    const updateSpotlight = (target) => {
      if (disposed || !target.isConnected) return;
      const rect = target.getBoundingClientRect();
      const width = Math.min(
        window.innerWidth - 16,
        rect.width + SPOTLIGHT_PADDING * 2,
      );
      const height = Math.min(
        window.innerHeight - 16,
        rect.height + SPOTLIGHT_PADDING * 2,
      );
      const spot = {
        top: Math.max(
          8,
          Math.min(rect.top - SPOTLIGHT_PADDING, window.innerHeight - height - 8),
        ),
        left: Math.max(
          8,
          Math.min(rect.left - SPOTLIGHT_PADDING, window.innerWidth - width - 8),
        ),
        width,
        height,
      };
      setSpotlight(spot);

      animationFrame = window.requestAnimationFrame(() => {
        if (disposed || !cardRef.current) return;
        const cardRect = cardRef.current.getBoundingClientRect();
        const margin = 16;
        const viewportWidth = document.documentElement.clientWidth;
        const belowTop = spot.top + spot.height + 16;
        const aboveTop = spot.top - cardRect.height - 16;
        const placement =
          belowTop + cardRect.height <= window.innerHeight - margin
            ? "below"
            : aboveTop >= margin
              ? "above"
              : "center";
        const top =
          placement === "below"
            ? belowTop
            : placement === "above"
              ? aboveTop
              : Math.max(
                  margin,
                  Math.min(
                    window.innerHeight - cardRect.height - margin,
                    spot.top + spot.height / 2 - cardRect.height / 2,
                  ),
                );
        const left = Math.max(
          margin,
          Math.min(
            spot.left + spot.width / 2 - cardRect.width / 2,
            viewportWidth - cardRect.width - margin,
          ),
        );
        const tailLeft = Math.max(
          24,
          Math.min(spot.left + spot.width / 2 - left, cardRect.width - 24),
        );
        setCardPosition({ top, left, placement, tailLeft });
      });
    };

    const findTarget = () => {
      if (disposed) return;
      const target = document.querySelector(step.target);
      if (!target) {
        attempts += 1;
        if (attempts < 30) {
          timer = window.setTimeout(findTarget, 100);
        } else {
          setActive(false);
          setSpotlight(null);
        }
        return;
      }

      if (!enteredStepsRef.current.has(stepIndex)) {
        enteredStepsRef.current.add(stepIndex);
        if (
          step.enter === "enable-sample-preview" &&
          target.getAttribute("aria-pressed") !== "true"
        ) {
          target.click();
        }
      }

      target.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: isReducedMotion() ? "auto" : "smooth",
      });
      timer = window.setTimeout(() => {
        updateSpotlight(target);
        nextButtonRef.current?.focus({ preventScroll: true });
      }, isReducedMotion() ? 0 : 350);
    };

    findTarget();
    const handleViewportChange = () => {
      const target = document.querySelector(step.target);
      if (target) updateSpotlight(target);
    };
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [active, finishTour, navigate, pathname, stepIndex, steps]);

  useEffect(() => {
    if (!active) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finishTour("dismissed");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, finishTour]);

  useEffect(() => {
    if (!active && !welcomeOpen) return undefined;
    const handleTabKey = (event) => {
      if (event.key !== "Tab") return;
      const container = active ? cardRef.current : welcomeRef.current;
      if (!container) return;
      const controls = Array.from(
        container.querySelectorAll('button:not(:disabled)'),
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!container.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleTabKey);
    return () => window.removeEventListener("keydown", handleTabKey);
  }, [active, welcomeOpen]);

  const step = steps[stepIndex];
  const goToStep = (index) => {
    if (index < 0) return;
    if (index >= steps.length) {
      finishTour();
      navigate("/");
      return;
    }
    setSpotlight(null);
    setStepIndex(index);
    if (pathname !== steps[index].path) navigate(steps[index].path);
  };

  const overlays = (welcomeOpen || (active && step)) && (
    <>
      {welcomeOpen && (
        <div className="guided-tour-welcome-backdrop">
          <section
            ref={welcomeRef}
            className="guided-tour-welcome"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guided-tour-welcome-title"
            aria-describedby="guided-tour-welcome-copy"
          >
            <span className="guided-tour-eyebrow">WELCOME TO DHAKA PHARMACY</span>
            <h2 id="guided-tour-welcome-title">See the highlights in 90 seconds</h2>
            <p id="guided-tour-welcome-copy">
              Take a short, guided look at the sample dashboard, medicine
              workflows, billing, and {isAdmin ? "reports." : "sales history."}
              {" "}You can skip it or replay it any time.
            </p>
            <div className="guided-tour-welcome-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={startTour}
                autoFocus
              >
                Start the tour <AppIcon icon={faArrowRight} />
              </button>
              <button
                type="button"
                className="guided-tour-explore"
                onClick={dismissWelcome}
              >
                Explore on my own
              </button>
            </div>
          </section>
        </div>
      )}

      {active && step && (
        <>
          <div className="guided-tour-scrim" aria-hidden="true">
            {!spotlight ? (
              <div className="guided-tour-scrim-panel guided-tour-scrim-full" />
            ) : (
              <>
                <div
                  className="guided-tour-scrim-panel"
                  style={{ top: 0, left: 0, right: 0, height: spotlight.top }}
                />
                <div
                  className="guided-tour-scrim-panel"
                  style={{
                    top: spotlight.top,
                    left: 0,
                    width: spotlight.left,
                    height: spotlight.height,
                  }}
                />
                <div
                  className="guided-tour-scrim-panel"
                  style={{
                    top: spotlight.top,
                    left: spotlight.left + spotlight.width,
                    right: 0,
                    height: spotlight.height,
                  }}
                />
                <div
                  className="guided-tour-scrim-panel"
                  style={{
                    top: spotlight.top + spotlight.height,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />
              </>
            )}
          </div>
          {spotlight && (
            <>
              <div
                className="guided-tour-spotlight"
                aria-hidden="true"
                style={{
                  top: spotlight.top,
                  left: spotlight.left,
                  width: spotlight.width,
                  height: spotlight.height,
                }}
              />
              <span
                className="guided-tour-pointer"
                aria-hidden="true"
                style={{
                  top: Math.min(
                    spotlight.top + spotlight.height - 2,
                    window.innerHeight - 34,
                  ),
                  left: Math.min(
                    spotlight.left + spotlight.width - 2,
                    window.innerWidth - 34,
                  ),
                }}
              >
                <AppIcon icon={faArrowPointer} />
              </span>
            </>
          )}
          <section
            ref={cardRef}
            className="guided-tour-card"
            data-placement={cardPosition.placement}
            role="dialog"
            aria-modal="true"
            aria-labelledby="guided-tour-step-title"
            aria-describedby="guided-tour-step-copy"
            aria-live="polite"
            style={{
              top: cardPosition.top,
              left: cardPosition.left,
              "--tour-tail-left": `${cardPosition.tailLeft}px`,
            }}
          >
            <div className="guided-tour-card-topline">
              <span className="guided-tour-eyebrow">{step.eyebrow}</span>
              <span className="guided-tour-progress">
                {stepIndex + 1} of {steps.length}
              </span>
            </div>
            <h2 id="guided-tour-step-title">{step.title}</h2>
            <p id="guided-tour-step-copy">{step.body}</p>
            <div
              className="guided-tour-progress-track"
              role="progressbar"
              aria-label="Tour progress"
              aria-valuemin={1}
              aria-valuemax={steps.length}
              aria-valuenow={stepIndex + 1}
            >
              <span style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
            </div>
            <div className="guided-tour-card-actions">
              <button
                type="button"
                className="guided-tour-skip"
                onClick={() => finishTour("dismissed")}
              >
                Skip tour
              </button>
              <div className="guided-tour-step-actions">
                {stepIndex > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary guided-tour-back"
                    onClick={() => goToStep(stepIndex - 1)}
                    aria-label="Previous tour step"
                  >
                    <AppIcon icon={faArrowLeft} />
                    <span>Back</span>
                  </button>
                )}
                <button
                  ref={nextButtonRef}
                  type="button"
                  className="btn btn-primary"
                  onClick={() => goToStep(stepIndex + 1)}
                >
                  {stepIndex === steps.length - 1 ? "Finish tour" : "Got it"}
                  {stepIndex < steps.length - 1 && <AppIcon icon={faArrowRight} />}
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className="guided-tour-launch"
        onClick={startTour}
        aria-label="Start the product tour"
        title="Take a quick product tour"
      >
        <AppIcon icon={faCircleQuestion} />
        <span>Tour</span>
      </button>
      {overlays && createPortal(overlays, document.body)}
    </>
  );
}
