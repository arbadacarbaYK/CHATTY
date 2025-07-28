import React, { useState } from 'react';
import multiavatar from '@multiavatar/multiavatar';

const skillLevels = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Expert', value: 'expert' },
];

const avatars = [
  { label: 'Girl', seed: 'Sophia' },
  { label: 'Boy', seed: 'Liam' },
];

export interface AvatarSelectorProps {
  onSelect: (avatar: { label: string; seed: string }, skill: string) => void;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({ onSelect }) => {
  const [selectedAvatar, setSelectedAvatar] = useState(avatars[0]);
  const [selectedSkill, setSelectedSkill] = useState(skillLevels[0].value);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-orange-100 to-yellow-200 p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Choose Your Guide</h1>
      <div className="flex space-x-8 mb-8">
        {avatars.map((avatar) => (
          <button
            key={avatar.label}
            className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-200 shadow-lg bg-white hover:border-orange-400 focus:outline-none ${selectedAvatar.label === avatar.label ? 'border-gray-400' : 'border-gray-200'}`}
            onClick={() => setSelectedAvatar(avatar)}
          >
            <div
              className="w-32 h-32 mb-2"
              dangerouslySetInnerHTML={{ __html: multiavatar(avatar.seed) }}
            />
            <span className="font-semibold text-lg text-gray-700">{avatar.label}</span>
          </button>
        ))}
      </div>
      <div className="mb-8">
        <label className="block text-lg font-medium text-gray-700 mb-2">Skill Level</label>
        <select
          className="p-2 rounded border border-gray-300 focus:border-orange-400 focus:outline-none"
          value={selectedSkill}
          onChange={(e) => setSelectedSkill(e.target.value)}
        >
          {skillLevels.map((level) => (
            <option key={level.value} value={level.value}>{level.label}</option>
          ))}
        </select>
      </div>
      <button
        className="px-8 py-3 bg-orange-500 text-white rounded-lg font-bold text-lg shadow hover:bg-orange-600 transition-all"
        onClick={() => onSelect(selectedAvatar, selectedSkill)}
      >
        Start Chatting
      </button>
    </div>
  );
}; 