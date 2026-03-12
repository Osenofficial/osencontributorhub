export type TaskCategory = 'content' | 'development' | 'design' | 'community' | 'research'

export const CONTRIBUTION_TYPES = [
  { group: 'Video Editing', items: [
    { id: 'video_reel', label: 'Reel editing', points: 5, category: 'development' as TaskCategory },
    { id: 'video_short', label: '1–5 min video', points: 10, category: 'development' as TaskCategory },
    { id: 'video_long', label: '5–10 min video', points: 15, category: 'development' as TaskCategory },
  ]},
  { group: 'Design', items: [
    { id: 'design_poster', label: 'Event poster', points: 6, category: 'design' as TaskCategory },
  ]},
  { group: 'Community Program & Hackathon', items: [
    { id: 'program_manager', label: 'Programme manager', points: 15, category: 'community' as TaskCategory },
    { id: 'social_creatives', label: 'Social media creatives', points: 6, category: 'content' as TaskCategory },
    { id: 'promo_video', label: 'Promotional video editing', points: 10, category: 'development' as TaskCategory },
    { id: 'technical_speaker', label: 'Technical speaker', points: 7, category: 'community' as TaskCategory },
    { id: 'volunteer_coordination', label: 'Volunteer coordination', points: 7, category: 'community' as TaskCategory },
    { id: 'judge_mentor', label: 'Judge / Mentor', points: 10, category: 'community' as TaskCategory },
  ]},
  { group: 'Speaker Sessions', items: [
    { id: 'speaker_online_technical', label: 'Online technical session', points: 15, category: 'community' as TaskCategory },
    { id: 'speaker_intro_online', label: 'Online intro to OSEN', points: 7, category: 'community' as TaskCategory },
    { id: 'speaker_intro_offline', label: 'Offline intro to OSEN', points: 10, category: 'community' as TaskCategory },
    { id: 'speaker_offline_technical', label: 'Offline technical session', points: 20, category: 'community' as TaskCategory },
    { id: 'speaker_hackathon_mentor', label: 'Mentoring during hackathons', points: 15, category: 'community' as TaskCategory },
  ]},
  { group: 'Volunteer-Based', items: [
    { id: 'volunteer_engagement', label: 'Community engagement', points: 2, category: 'community' as TaskCategory },
    { id: 'volunteer_moderation', label: 'Group moderation / management', points: 3, category: 'community' as TaskCategory },
    { id: 'volunteer_formatting', label: 'Formatting groups / docs', points: 3, category: 'content' as TaskCategory },
    { id: 'volunteer_sponsor_support', label: 'Sponsor support', points: 6, category: 'community' as TaskCategory },
    { id: 'volunteer_updates', label: 'Event updates', points: 2, category: 'community' as TaskCategory },
    { id: 'volunteer_registrations', label: 'Registrations', points: 4, category: 'community' as TaskCategory },
    { id: 'volunteer_feedback', label: 'Feedback collection', points: 3, category: 'community' as TaskCategory },
  ]},
] as const

export function getContributionLabel(category: string, contributionTypeId?: string): string {
  if (contributionTypeId) {
    const item = CONTRIBUTION_TYPES.flatMap(g => g.items).find(i => i.id === contributionTypeId)
    if (item) return item.label
  }
  return category.charAt(0).toUpperCase() + category.slice(1)
}
