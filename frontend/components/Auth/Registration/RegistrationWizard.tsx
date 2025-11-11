import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import Step1UserInfo from './Step1UserInfo';
import Step2EmailVerification from './Step2EmailVerification';
import Step3AuthenticatorSetup from './Step3AuthenticatorSetup';
import Step4AuthenticatorVerify from './Step4AuthenticatorVerify';
import Step5RecoveryCode from './Step5RecoveryCode';
import Step6PasskeySetup from './Step6PasskeySetup';
import Step7BackupCodes from './Step7BackupCodes';

export interface RegistrationData {
  username: string;
  email: string;
  userId?: string;
  totpSecret?: string;
  qrCodeImage?: string;
  backupCodes?: string[];
}

const RegistrationWizard: React.FC = () => {
  const { t } = useLanguage();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    username: '',
    email: '',
  });

  const totalSteps = 7;

  const updateData = (data: Partial<RegistrationData>) => {
    setRegistrationData(prev => ({ ...prev, ...data }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeRegistration = () => {
    toast.success(t('registration.registrationComplete'));
    setTimeout(() => {
      router.push('/login');
    }, 2000);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1UserInfo data={registrationData} updateData={updateData} onNext={nextStep} />;
      case 2:
        return <Step2EmailVerification data={registrationData} updateData={updateData} onNext={nextStep} onBack={prevStep} />;
      case 3:
        return <Step3AuthenticatorSetup data={registrationData} updateData={updateData} onNext={nextStep} onBack={prevStep} />;
      case 4:
        return <Step4AuthenticatorVerify data={registrationData} onNext={nextStep} onBack={prevStep} />;
      case 5:
        return <Step5RecoveryCode data={registrationData} onNext={nextStep} onBack={prevStep} />;
      case 6:
        return <Step6PasskeySetup data={registrationData} updateData={updateData} onNext={nextStep} onSkip={nextStep} />;
      case 7:
        return <Step7BackupCodes data={registrationData} onComplete={completeRegistration} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen theme-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium theme-text-secondary">
              {t('common.step')} {currentStep} {t('common.of')} {totalSteps}
            </span>
            <span className="text-sm font-medium theme-text-secondary">
              {Math.round((currentStep / totalSteps) * 100)}%
            </span>
          </div>
          <div className="w-full h-2 theme-bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Main Card */}
        <div className="theme-bg-secondary rounded-2xl shadow-xl p-8 border theme-border">
          <div className="mb-8">
            <h1 className="text-3xl font-bold theme-text-primary mb-2">
              {t('registration.title')}
            </h1>
            <p className="theme-text-secondary">
              {t(`registration.step${currentStep}Title`)}
            </p>
          </div>

          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default RegistrationWizard;
