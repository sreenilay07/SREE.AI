
import React from 'react';
import { AIAnalysisResponse } from '../../types';

interface VerdictCardProps {
  analysis: AIAnalysisResponse | null;
}

const VerdictCard: React.FC<VerdictCardProps> = ({ analysis }) => {
  if (!analysis) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-3"></div>
        <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-3/4"></div>
      </div>
    );
  }

  let verdictColor = 'text-gray-100';
  const verdictText = (analysis?.verdict || "HOLD").toUpperCase();

  if (verdictText.includes('BUY') || verdictText.includes('ACCUMULATE')) {
    verdictColor = 'text-green-400';
  } else if (verdictText.includes('SELL') || verdictText.includes('PROFIT')) {
    verdictColor = 'text-red-400';
  } else if (verdictText.includes('HOLD')) {
    verdictColor = 'text-yellow-400';
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-850 p-6 rounded-lg shadow-2xl border border-gray-700">
      <h3 className={`text-2xl sm:text-3xl font-bold ${verdictColor} mb-3 tracking-wide`}>
        SreeAI Verdict: {analysis?.verdict || "Determining..."}
      </h3>
      <p className="text-sm sm:text-base text-gray-300 leading-relaxed mb-4">
        <span className="font-semibold text-sky-400">AI Rationale:</span> {analysis?.aiRationale || "No rationale available."}
      </p>

      {/* Verdict Logic Table */}
      {analysis.verdictDetails && analysis.verdictDetails.length > 0 && (
        <div className="mt-6 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
          <h4 className="text-lg font-semibold text-sky-300 mb-3">Verdict Logic (Why this verdict?)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-300">
              <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                <tr>
                  <th className="px-4 py-2">Metric</th>
                  <th className="px-4 py-2">Actual Value</th>
                  <th className="px-4 py-2">Preferred Range</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {analysis.verdictDetails.map((detail, index) => (
                  <tr key={index} className="border-b border-gray-700 hover:bg-gray-800/50">
                    <td className="px-4 py-2 font-medium text-gray-200">{detail.metric || 'N/A'}</td>
                    <td className="px-4 py-2">{detail.actual || 'N/A'}</td>
                    <td className="px-4 py-2">{detail.preferred || 'N/A'}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${detail.status === 'Positive' ? 'bg-green-900 text-green-300' :
                        detail.status === 'Negative' ? 'bg-red-900 text-red-300' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                        {detail.status || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Educational Section - Helping the user understand the 'Why' */}
      {analysis.educationalInsights && (
        <div className="mt-6 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
          <h4 className="text-lg font-semibold text-sky-300 mb-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.57 50.57 0 0 0-2.658-.813A59.905 59.905 0 0 1 12 3.493a59.902 59.902 0 0 1 10.499 5.258 50.55 50.55 0 0 0-2.658.813m-15.482 0A50.55 50.55 0 0 1 12 13.489a50.55 50.55 0 0 1 6.744-3.342M12 13.489V18" />
            </svg>
            Why this decision? (Learn to Analyze)
          </h4>
          <p className="text-sm text-gray-300 mb-2 italic">"{analysis.educationalInsights.observation}"</p>

          {analysis.educationalInsights.sectorFactors && analysis.educationalInsights.sectorFactors.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Key Factors for this Sector:</p>
              <div className="flex flex-wrap gap-2">
                {analysis.educationalInsights.sectorFactors.map((factor, i) => (
                  <span key={i} className="text-xs bg-gray-700 text-gray-200 px-2 py-1 rounded-full border border-gray-600">
                    {factor}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sources Section */}
      {analysis.sources && analysis.sources.length > 0 && (
        <div className="mt-4 text-xs text-gray-500">
          <p className="font-semibold mb-1">Data Sources:</p>
          <ul className="list-disc pl-4 space-y-1">
            {analysis.sources.map((source, idx) => (
              <li key={idx} className="truncate">
                <a href={source} target="_blank" rel="noopener noreferrer" className="hover:text-sky-400 underline decoration-gray-600 underline-offset-2">
                  {source}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default VerdictCard;
