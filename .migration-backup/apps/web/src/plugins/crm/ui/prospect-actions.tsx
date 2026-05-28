'use client';

import React from 'react';
import { MessageSquare, Phone, Calendar } from 'lucide-react';

interface ProspectActionsProps {
  prospectId: string;
  tenantId: string;
  prospect: any;
}

export function CrmQuickActions({ prospectId, prospect }: ProspectActionsProps) {
  
  const handleLogActivity = async (type: 'call' | 'email' | 'meeting') => {
    try {
      // Création rapide d'une activité liée au prospect
      const response = await fetch('/api/v1/plugins/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          subject: `${type.charAt(0).toUpperCase() + type.slice(1)} with ${prospect.firstName || prospect.name}`,
          status: 'scheduled',
          relatedToId: prospectId,
          relatedToType: 'contact',
          dueDate: new Date().toISOString()
        })
      });

      if (!response.ok) throw new Error('Failed to create activity');

      alert(`${type} ajouté au timeline CRM avec succès !`);
    } catch (error) {
      console.error(error);
      alert('Impossible de créer l\'activité.');
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleLogActivity('call')}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Phone className="w-4 h-4" />
        <span className="hidden sm:inline">Appeler</span>
      </button>
      
      <button
        onClick={() => handleLogActivity('email')}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
        <span className="hidden sm:inline">Email</span>
      </button>

      <button
        onClick={() => handleLogActivity('meeting')}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Calendar className="w-4 h-4" />
        <span className="hidden sm:inline">RDV</span>
      </button>
    </div>
  );
}
