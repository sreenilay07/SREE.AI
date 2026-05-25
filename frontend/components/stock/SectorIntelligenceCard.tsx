import React from 'react';
import { AIAnalysisResponse } from '../../types';

interface SectorIntelligenceCardProps {
  analysis: any; // Using any because we extended it in the backend response
  sectorName: string;
}

const SectorIntelligenceCard: React.FC<SectorIntelligenceCardProps> = ({ analysis, sectorName }) => {
  const intel = analysis?.sectorSpecificIntelligence;

  if (!intel) {
    return null; // Don't render if the AI didn't provide sectorSpecificIntelligence
  }

  const { sector, parameters, sectorPipeline } = intel;

  // Icons for the 6-stage pipeline
  const pipelineSteps = [
    {
      title: 'Data Collection',
      desc: sectorPipeline?.dataCollection || 'Collected latest prices and sector metrics.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-sky-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6.75m0 0-3-3m3 3 3-3m-8.25 6a9 9 0 1 1-1.5 0" />
        </svg>
      ),
    },
    {
      title: 'Sector Classification',
      desc: sectorPipeline?.sectorClassification || `Classified into ${sector} sector.`,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-emerald-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a2.25 2.25 0 0 0 3.181 0l4.319-4.319a2.25 2.25 0 0 0 0-3.182L11.16 3.659A2.25 2.25 0 0 0 9.568 3Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
        </svg>
      ),
    },
    {
      title: 'Feature Generator',
      desc: sectorPipeline?.sectorSpecificFeatureGenerator || 'Generated sector-specific features.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-indigo-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      ),
    },
    {
      title: 'AI Prediction Engine',
      desc: sectorPipeline?.aiPredictionEngine || 'Computed buy/sell/hold vector scoring.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-purple-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21m0 0-.768-3.158m.768 3.158 1.125-3.158M14.187 15.904 15 21m0 0-.768-3.158m.768 3.158 1.125-3.158M4.47 5.18h15.06a1.5 1.5 0 0 1 1.5 1.5v8.42a1.5 1.5 0 0 1-1.5 1.5H4.47a1.5 1.5 0 0 1-1.5-1.5V6.68a1.5 1.5 0 0 1 1.5-1.5Z" />
        </svg>
      ),
    },
    {
      title: 'Confidence Scoring',
      desc: sectorPipeline?.confidenceScoring || 'Calculated logic verification confidence.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-yellow-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
        </svg>
      ),
    },
    {
      title: 'Risk Engine',
      desc: sectorPipeline?.riskEngine || 'Evaluated specific macro and asset risks.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-red-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      ),
    },
  ];

  // Map parameter keys to cleaner visual names if applicable
  const getParamLabel = (key: string) => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-850 p-6 rounded-lg shadow-2xl border border-gray-700 mt-8">
      <h3 className="text-2xl font-bold text-sky-400 mb-2 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-sky-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-.778.099-1.533.284-2.253" />
        </svg>
        Layer 2 — Sector-Specific Intelligence ({sector})
      </h3>
      <p className="text-gray-400 text-sm mb-6">
        Detailed fundamental, macroeconomic, and alternative indicators checked exclusively for {sector} segment investments.
      </p>

      {/* Sector Specific Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {Object.entries(parameters).map(([key, val]: any) => (
          <div key={key} className="bg-gray-900/60 p-4 rounded-lg border border-gray-700 hover:border-sky-500/50 transition duration-300">
            <h5 className="text-xs font-semibold text-sky-300 uppercase tracking-wider mb-1">
              {getParamLabel(key)}
            </h5>
            <p className="text-gray-200 text-sm leading-relaxed font-medium">
              {val || 'Fetching live indicator...'}
            </p>
          </div>
        ))}
      </div>

      {/* Multi-Layer Flow Pipeline Title */}
      <h4 className="text-lg font-bold text-gray-200 mb-4 border-t border-gray-700 pt-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-emerald-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        SreeAI Processing Pipeline (6-Stage Engine Workflow)
      </h4>

      {/* 6-Stage Horizontal Flow Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pipelineSteps.map((step, idx) => (
          <div key={step.title} className="bg-gray-900/30 p-4 rounded-lg border border-gray-750 flex gap-3 items-start relative hover:bg-gray-800/20 transition duration-200">
            <div className="bg-gray-850 p-2 rounded-lg border border-gray-700 flex-shrink-0">
              {step.icon}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold bg-gray-800 text-sky-400 px-1.5 py-0.5 rounded border border-gray-700">
                  {idx + 1}
                </span>
                <h5 className="text-sm font-semibold text-gray-250">{step.title}</h5>
              </div>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SectorIntelligenceCard;
