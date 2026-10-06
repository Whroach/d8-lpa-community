import mongoose from 'mongoose';

/**
 * The admin activity log: one document for every moderation decision an admin
 * takes - who did it, to whom, when, why, and the member report it answered
 * (if any). Entries are only ever added; nothing edits or removes them.
 *
 * Names and email addresses are copied in at the time of the action so the
 * log still reads correctly after an account is renamed or deleted.
 */
export const MODERATION_ACTIONS = [
  'warn',
  'remove_warning',
  'suspend',
  'unsuspend',
  'ban',
  'unban',
  'dismiss_report',
  'reopen_report'
];

const moderationActionSchema = new mongoose.Schema({
  action: { type: String, enum: MODERATION_ACTIONS, required: true },
  // The member the action was taken on.
  target_user: { type: String, required: true },
  target_name: { type: String, default: '' },
  target_email: { type: String, default: '' },
  // The admin who took it.
  admin_id: { type: String, required: true },
  admin_name: { type: String, default: '' },
  admin_email: { type: String, default: '' },
  reason: { type: String, default: '', maxlength: 1000 },
  // The member report this decision answered, if it came from the report queue.
  report_id: { type: String, default: null }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

moderationActionSchema.index({ created_at: -1 });
moderationActionSchema.index({ target_user: 1, created_at: -1 });

const ModerationAction = mongoose.model('ModerationAction', moderationActionSchema);

export default ModerationAction;
