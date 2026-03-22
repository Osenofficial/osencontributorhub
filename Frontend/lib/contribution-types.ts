export type TaskCategory = 'content' | 'development' | 'design' | 'community' | 'research'

export const CONTRIBUTION_TYPES = [
  {
    group: 'Video Editing',
    items: [
      { id: 'video_reel', label: 'Reel editing', points: 5, category: 'development' as TaskCategory },
      { id: 'video_short', label: '1–5 min video', points: 10, category: 'development' as TaskCategory },
      { id: 'video_long', label: '5–10 min video', points: 15, category: 'development' as TaskCategory },
    ],
  },
  {
    group: 'Design',
    items: [
      { id: 'design_small_changes', label: 'Small design changes', points: 2, category: 'design' as TaskCategory },
      { id: 'design_poster', label: 'Event poster', points: 4, category: 'design' as TaskCategory },
      { id: 'design_thumbnail', label: 'Thumbnail', points: 3, category: 'design' as TaskCategory },
    ],
  },
  {
    group: 'Community',
    items: [
      {
        id: 'interview_taken_over5',
        label: 'Interviews taken (more than 5)',
        points: 8,
        category: 'community' as TaskCategory,
      },
      {
        id: 'interview_taken_over10',
        label: 'Interviews taken (more than 10)',
        points: 15,
        category: 'community' as TaskCategory,
      },
      {
        id: 'basic_community_work',
        label: 'Basic community work',
        points: 3,
        category: 'community' as TaskCategory,
      },
      {
        id: 'social_media_post',
        label: 'Social media post',
        points: 3,
        category: 'content' as TaskCategory,
      },
      {
        id: 'new_chapter_onboard',
        label: 'New chapter onboard',
        points: 12,
        category: 'community' as TaskCategory,
      },
    ],
  },
  {
    group: 'Community Program & Hackathon',
    items: [
      { id: 'program_manager', label: 'Programme manager', points: 15, category: 'community' as TaskCategory },
      { id: 'social_creatives', label: 'Social media', points: 9, category: 'content' as TaskCategory },
      { id: 'community_program_design', label: 'Design', points: 10, category: 'design' as TaskCategory },
      { id: 'promo_video', label: 'Promotional video editing', points: 10, category: 'development' as TaskCategory },
      { id: 'technical_speaker', label: 'Technical speaker', points: 7, category: 'community' as TaskCategory },
      { id: 'volunteer_coordination', label: 'Volunteer coordination', points: 7, category: 'community' as TaskCategory },
      { id: 'judge_mentor', label: 'Judge / Mentor', points: 10, category: 'community' as TaskCategory },
    ],
  },
  {
    group: 'Speaker Sessions',
    items: [
      { id: 'speaker_online_technical', label: 'Online technical session', points: 15, category: 'community' as TaskCategory },
      { id: 'speaker_intro_online', label: 'Online intro to OSEN', points: 7, category: 'community' as TaskCategory },
      { id: 'speaker_intro_offline', label: 'Offline intro to OSEN', points: 10, category: 'community' as TaskCategory },
      { id: 'speaker_offline_technical', label: 'Offline technical session', points: 20, category: 'community' as TaskCategory },
      { id: 'speaker_hackathon_mentor', label: 'Mentoring during hackathons', points: 15, category: 'community' as TaskCategory },
    ],
  },
  {
    group: 'Volunteer-Based',
    items: [
      { id: 'volunteer_engagement', label: 'Community engagement', points: 2, category: 'community' as TaskCategory },
      { id: 'volunteer_moderation', label: 'Group moderation / management', points: 3, category: 'community' as TaskCategory },
      { id: 'sponsorship_group_management', label: 'Sponsorship group management', points: 5, category: 'community' as TaskCategory },
      { id: 'mou_document_prep', label: 'MOU & document preparation', points: 6, category: 'community' as TaskCategory },
      { id: 'volunteer_formatting', label: 'Formatting groups / docs', points: 3, category: 'content' as TaskCategory },
    ],
  },
]

export type ContributionCatalogItem = (typeof CONTRIBUTION_TYPES)[number]['items'][number]

export function findContributionItemById(id: string): ContributionCatalogItem | undefined {
  for (const g of CONTRIBUTION_TYPES) {
    const found = g.items.find((i) => i.id === id)
    if (found) return found
  }
  return undefined
}

/** Older tasks may still reference these ids after the catalog was updated. */
const LEGACY_CONTRIBUTION_LABELS: Record<string, string> = {
  social_media_community: 'Social media post',
  volunteer_sponsor_support: 'Sponsor support',
  volunteer_updates: 'Event updates',
  volunteer_registrations: 'Registrations',
  volunteer_feedback: 'Feedback collection',
}

export function getContributionLabel(category: string, contributionTypeId?: string): string {
  if (contributionTypeId) {
    const item = findContributionItemById(contributionTypeId)
    if (item) return item.label
    const legacy = LEGACY_CONTRIBUTION_LABELS[contributionTypeId]
    if (legacy) return legacy
  }
  return category.charAt(0).toUpperCase() + category.slice(1)
}
