/**
 * Demo data for LOCAL development and end-to-end tests only.
 *
 * Everyone here is made up: invented names, example.test email addresses and
 * drawn (initials-on-a-colour) pictures - no photos of real people. It only
 * ever runs against a local database (see assertLocal below).
 */
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Event from '../models/Event.js';
import Match from '../models/Match.js';
import Like from '../models/Like.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import LPAMembership from '../models/LPAMembership.js';
import { isLocalMongoUri } from '../utils/script-env.js';
import { LOCAL_UPLOAD_DIR } from '../providers/storage.js';
import config from '../config/env.js';

// Shared sign-in password for every demo account. Local use only.
export const DEMO_PASSWORD = 'Demo-Pass-2026!';
export const DEMO_ADMIN_EMAIL = 'admin@example.test';

const PEOPLE = [
  { key: 'dana', first: 'Dana', last: 'Whitlock', gender: 'female', born: '1972-04-11', city: 'Tulsa', state: 'Oklahoma', job: 'School librarian', interests: ['Gardening', 'Reading', 'Cooking', 'Board games'], bio: 'Librarian, tomato grower and reluctant karaoke singer. I like long breakfasts and short meetings.', music: ['Country', 'Classic rock'], colour: '#8a3b5c' },
  { key: 'marcus', first: 'Marcus', last: 'Bellamy', gender: 'male', born: '1968-09-02', city: 'Oklahoma City', state: 'Oklahoma', job: 'Bookkeeper', interests: ['Fishing', 'Cooking', 'Board games', 'Travel'], bio: 'Numbers by day, chili by night. Looking for someone to laugh with at District events.', music: ['Jazz', 'Blues'], colour: '#2f5d8a' },
  { key: 'ines', first: 'Ines', last: 'Calloway', gender: 'female', born: '1980-01-23', city: 'Dallas', state: 'Texas', job: 'Graphic designer', interests: ['Art', 'Hiking', 'Photography', 'Coffee'], bio: 'I draw for a living and hike for fun. Ask me about my rescue dog, Biscuit.', music: ['Indie', 'Pop'], colour: '#3d7a5a' },
  { key: 'theo', first: 'Theo', last: 'Marchetti', gender: 'male', born: '1963-06-30', city: 'Little Rock', state: 'Arkansas', job: 'Retired teacher', interests: ['Woodworking', 'Reading', 'Gardening', 'Chess'], bio: 'Taught history for thirty years. Now I build birdhouses and lose at chess to my niece.', music: ['Classical', 'Folk'], colour: '#7a5a2f' },
  { key: 'priya', first: 'Priya', last: 'Lindqvist', gender: 'female', born: '1976-11-05', city: 'Austin', state: 'Texas', job: 'Nurse', interests: ['Yoga', 'Cooking', 'Travel', 'Movies'], bio: 'Night-shift nurse, daytime napper. I make a very good lentil soup.', music: ['R&B', 'Pop'], colour: '#5a3d8a' },
  { key: 'sam', first: 'Sam', last: 'Okonkwo-Reyes', gender: 'non_binary', born: '1984-03-17', city: 'New Orleans', state: 'Louisiana', job: 'Sound engineer', interests: ['Music', 'Movies', 'Cooking', 'Photography'], bio: 'I mix records and make gumbo. Happy to meet friends as much as dates.', music: ['Jazz', 'Rock'], colour: '#2f7a7a' },
  { key: 'gloria', first: 'Gloria', last: 'Ashdown', gender: 'female', born: '1961-08-14', city: 'Wichita', state: 'Kansas', job: 'Florist', interests: ['Gardening', 'Baking', 'Crafts', 'Church'], bio: 'Florist for forty years. I still cannot keep a houseplant alive at home.', music: ['Gospel', 'Country'], colour: '#8a4a2f' },
  { key: 'walt', first: 'Walt', last: 'Pemberton', gender: 'male', born: '1970-12-09', city: 'Tulsa', state: 'Oklahoma', job: 'Radio host', interests: ['Music', 'Travel', 'Fishing', 'Coffee'], bio: 'Morning radio voice, afternoon fisherman. First round of coffee is on me.', music: ['Classic rock', 'Blues'], colour: '#4a4a8a' },
];

function avatarSvg(name, colour, variant) {
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const shapes = [
    `<circle cx="300" cy="330" r="190" fill="rgba(255,255,255,0.12)"/>`,
    `<rect x="90" y="150" width="420" height="420" rx="60" fill="rgba(255,255,255,0.12)" transform="rotate(8 300 360)"/>`,
    `<path d="M0 560 Q300 380 600 560 V800 H0Z" fill="rgba(255,255,255,0.14)"/>`,
  ][variant % 3];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800" role="img" aria-label="Illustrated placeholder picture for ${name}">
  <rect width="600" height="800" fill="${colour}"/>
  ${shapes}
  <text x="300" y="400" font-family="Arial, Helvetica, sans-serif" font-size="210" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text>
  <text x="300" y="730" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="rgba(255,255,255,0.85)" text-anchor="middle">Demo picture ${variant + 1}</text>
</svg>`;
}

function writeAvatar(key, name, colour, variant) {
  const relative = `demo/${key}-${variant + 1}.svg`;
  const target = path.join(LOCAL_UPLOAD_DIR, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, avatarSvg(name, colour, variant));
  return `${config.publicApiUrl}/local-uploads/${relative}`;
}

function assertLocal() {
  const uri = `mongodb://${mongoose.connection.host}:${mongoose.connection.port}`;
  if (process.env.NODE_ENV === 'production' || !isLocalMongoUri(uri)) {
    throw new Error('The demo seed only runs against a local database outside production.');
  }
}

const daysFromNow = (days, hour = 18) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
};

export async function seedDemo({ reset = false } = {}) {
  assertLocal();
  if (reset) await mongoose.connection.dropDatabase();
  if (await User.countDocuments() > 0) return { skipped: true };

  const users = {};
  for (const [index, person] of PEOPLE.entries()) {
    const user = await User.create({
      email: `${person.key}@example.test`,
      password: DEMO_PASSWORD,
      first_name: person.first,
      last_name: person.last,
      birthdate: new Date(person.born),
      gender: person.gender,
      onboarding_completed: true,
      agreed_to_guidelines: true,
      email_verified: true,
      has_seen_tour: true,
    });
    const photos = [0, 1].map((variant) => writeAvatar(person.key, `${person.first} ${person.last}`, person.colour, variant));
    await Profile.create({
      user_id: user._id.toString(),
      bio: person.bio,
      occupation: person.job,
      interests: person.interests,
      favorite_music: person.music,
      location_city: person.city,
      location_state: person.state,
      district_number: '8',
      photos,
      profile_picture_url: photos[0],
      looking_for_gender: ['everyone'],
      age_preference_min: 30,
      age_preference_max: 80,
      prompt_good_at: index % 2 ? 'Remembering birthdays' : 'Making a room feel welcome',
      prompt_perfect_weekend: 'A farmers market, a long lunch and no alarm clock.',
      prompt_message_if: 'You have a favourite pie and are willing to defend it.',
      lpa_membership_id: `DEMO-${1000 + index}`,
    });
    await LPAMembership.create({ user_id: user._id.toString(), lpa_membership_id: `DEMO-${1000 + index}` });
    users[person.key] = user;
  }

  const admin = await User.create({
    email: DEMO_ADMIN_EMAIL,
    password: DEMO_PASSWORD,
    first_name: 'Avery',
    last_name: 'Moderator',
    birthdate: new Date('1975-01-01'),
    gender: 'prefer_not_to_say',
    role: 'admin',
    onboarding_completed: true,
    agreed_to_guidelines: true,
    email_verified: true,
    has_seen_tour: true,
  });
  await Profile.create({ user_id: admin._id.toString(), bio: 'Demo administrator account.' });

  const id = (key) => users[key]._id.toString();

  // Dana and Marcus have matched and are chatting.
  await Like.create({ from_user: id('dana'), to_user: id('marcus'), type: 'like' });
  await Like.create({ from_user: id('marcus'), to_user: id('dana'), type: 'like' });
  const match = await Match.create({ users: [id('dana'), id('marcus')] });
  const lines = [
    ['marcus', 'Hi Dana! I saw you grow tomatoes. Any luck this year?'],
    ['dana', 'Hello Marcus! Too much luck. I am giving them away to the neighbours.'],
    ['marcus', 'I make a decent chili. Sounds like we should trade.'],
  ];
  for (const [index, [who, content]] of lines.entries()) {
    await Message.create({
      match_id: match._id.toString(),
      sender_id: id(who),
      content,
      read: index < 2,
      created_at: new Date(Date.now() - (lines.length - index) * 3600 * 1000),
    });
  }
  match.last_message = lines[lines.length - 1][1];
  match.last_message_at = new Date(Date.now() - 3600 * 1000);
  match.last_message_sender = id('marcus');
  match.unread_counts = new Map([[id('dana'), 1]]);
  await match.save();

  // Dana and Walt matched but have not written yet (for conversation starters).
  await Like.create({ from_user: id('dana'), to_user: id('walt'), type: 'like' });
  await Like.create({ from_user: id('walt'), to_user: id('dana'), type: 'like' });
  await Match.create({ users: [id('dana'), id('walt')] });

  // Theo has liked Dana (she can like back to match).
  await Like.create({ from_user: id('theo'), to_user: id('dana'), type: 'like' });

  const events = await Event.create([
    {
      title: 'District 8 Fall Picnic', category: 'regional',
      description: 'Bring a dish to share. Shade, seating at several heights and step-free paths throughout. Families welcome.',
      location: 'Riverside Park Pavilion, Tulsa, OK', start_date: daysFromNow(9, 11), end_date: daysFromNow(9, 15),
      attendees: [id('marcus'), id('gloria'), id('walt')], created_by: admin._id.toString(),
      rsvp_notes: new Map([[id('walt'), 'Driving from midtown - two seats free']]),
    },
    {
      title: 'Coffee and Board Games', category: 'social',
      description: 'A relaxed afternoon. Games provided, or bring your favourite.',
      location: 'Maple Street Cafe, Oklahoma City, OK', start_date: daysFromNow(3, 14), end_date: daysFromNow(3, 17),
      max_attendees: 12, attendees: [id('theo')], created_by: admin._id.toString(),
    },
    {
      title: 'Singles Dinner Evening', category: 'dating',
      description: 'A set menu, assigned seating that changes between courses, and no pressure.',
      location: 'The Garden Room, Dallas, TX', start_date: daysFromNow(20, 18), end_date: daysFromNow(20, 21),
      max_attendees: 20, attendees: [], created_by: admin._id.toString(),
    },
    {
      title: 'Chapter Meeting (cancelled)', category: 'local-chapter',
      description: 'Monthly chapter business meeting.',
      location: 'Community Centre, Wichita, KS', start_date: daysFromNow(5, 19),
      attendees: [], created_by: admin._id.toString(), is_cancelled: true, cancelled_at: new Date(),
    },
  ]);

  await Notification.create([
    { user_id: id('dana'), type: 'match', title: 'New Match!', message: 'You and Walt matched! Start a conversation now.', related_user: id('walt') },
    { user_id: id('dana'), type: 'like', title: 'Someone Likes You!', message: 'Someone new has liked your profile. Keep browsing to find out who!' },
    { user_id: id('dana'), type: 'event', title: 'New Event!', message: `Check out the new event: ${events[0].title}`, related_event: events[0]._id.toString() },
    { user_id: id('dana'), type: 'news', title: 'Welcome to D8 LPA', message: 'Thank you for joining. Say hello, and please be kind.', announcement_id: 'demo-welcome', read: true },
  ]);

  return { skipped: false, members: PEOPLE.length, events: events.length };
}
