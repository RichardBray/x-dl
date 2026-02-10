type ArticleStep = 'extracting' | 'extracting_audio' | 'transcribing' | 'generating' | 'done' | 'error';

const STEPS = [
  { key: 'extracting', label: 'Extract Video' },
  { key: 'extracting_audio', label: 'Extract Audio' },
  { key: 'transcribing', label: 'Transcribe' },
  { key: 'generating', label: 'Generate Article' },
] as const;

const stepOrder = STEPS.map((s) => s.key);

function getStepState(stepKey: string, currentStep: ArticleStep): 'pending' | 'active' | 'complete' {
  const currentIndex = stepOrder.indexOf(currentStep as typeof stepOrder[number]);
  const stepIndex = stepOrder.indexOf(stepKey as typeof stepOrder[number]);

  if (currentStep === 'done') return 'complete';
  if (currentStep === 'error') {
    return stepIndex < currentIndex ? 'complete' : stepIndex === currentIndex ? 'active' : 'pending';
  }
  if (stepIndex < currentIndex) return 'complete';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

interface ProgressStepsProps {
  currentStep: ArticleStep;
}

export function ProgressSteps({ currentStep }: ProgressStepsProps) {
  return (
    <div className="progress-steps">
      {STEPS.map((step, i) => {
        const state = getStepState(step.key, currentStep);
        return (
          <div key={step.key} className={`progress-step ${state}`}>
            <div className="step-indicator">
              {state === 'complete' ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
            <span className="step-label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
