import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: rootEnvPath });

// Import models
import User from './models/User.js';
import Profile from './models/Profile.js';
import Event from './models/Event.js';
import Match from './models/Match.js';
import Like from './models/Like.js';
import Message from './models/Message.js';
import Notification from './models/Notification.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://lpa-d8:Qd1gXd48ljTQDzGP3477UeNrlQrdRjhG7eXpQ@cluster0.iogpu.mongodb.net/d8lpa?retryWrites=true&w=majority&appName=Cluster0';

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Drop all collections to reset schema validation
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('Dropping all collections...');
    for (const collection of collections) {
      try {
        await db.dropCollection(collection.name);
        console.log(`  Dropped: ${collection.name}`);
      } catch (err) {
        console.log(`  Could not drop ${collection.name}: ${err.message}`);
      }
    }
    console.log('All collections dropped');

    // Force mongoose to recreate collections with latest schema
    await User.createCollection();
    await Profile.createCollection();
    await Event.createCollection();
    await Match.createCollection();
    await Like.createCollection();
    await Message.createCollection();
    await Notification.createCollection();
    console.log('Recreated collections with latest schema');

    // Don't pre-hash passwords - the User model's pre-save hook will hash them
    const password = 'password123';
    const adminPassword = 'admin123';

    // ===== USER 1: ADMIN =====
    const adminUser = await User.create({
      email: 'admin@d8lpa.com',
      password: adminPassword,
      first_name: 'Marcus',
      last_name: 'Williams',
      birthdate: new Date('1988-03-15'),
      gender: 'male',
      looking_for: ['female'],
      looking_for_relationship: 'long-term',
      role: 'admin',
      onboarding_completed: true,
      email_verified: true,
      photos: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1522556189639-b150ed9c4330?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=400&h=500&fit=crop'
      ]
    });

    await Profile.create({
      user_id: adminUser._id,
      bio: 'LPA chapter leader and community advocate. Passionate about bringing people together and creating inclusive spaces. When I\'m not organizing events, you\'ll find me playing basketball, cooking for friends, or exploring new hiking trails.',
      height: 145,
      occupation: 'Community Organizer',
      education: 'masters',
      religion: 'christian',
      drinking: 'socially',
      smoking: 'never',
      wants_kids: 'have-kids',
      interests: ['community service', 'basketball', 'cooking', 'hiking', 'photography', 'mentoring', 'public speaking', 'travel'],
      looking_for: 'Looking for a genuine connection with someone who values family, community, and personal growth. Someone who isn\'t afraid to be themselves and appreciates the little things in life.',
      life_goals: 'Continue growing our local LPA chapter, mentor young adults in the community, and eventually write a book about advocacy and leadership. Family is everything to me.',
      languages: ['English', 'Spanish'],
      cultural_background: 'African American',
      distance_preference: 50,
      age_preference_min: 30,
      age_preference_max: 45,
      location_city: 'San Francisco',
      location_state: 'California'
    });

    console.log('Created Admin: admin@d8lpa.com / admin123');

    // ===== USER 2: EMMA =====
    const emmaUser = await User.create({
      email: 'emma.wilson@example.com',
      password,
      first_name: 'Emma',
      last_name: 'Wilson',
      birthdate: new Date('1992-07-22'),
      gender: 'female',
      looking_for: ['male'],
      looking_for_relationship: 'long-term',
      onboarding_completed: true,
      email_verified: true,
      photos: [
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=500&fit=crop'
      ]
    });

    await Profile.create({
      user_id: emmaUser._id,
      bio: 'Pediatric nurse by day, aspiring baker by night. I believe in kindness, good coffee, and the healing power of homemade cookies. My friends say I give the best hugs and always know how to make people smile.',
      height: 122,
      occupation: 'Pediatric Nurse',
      education: 'bachelors',
      religion: 'spiritual',
      drinking: 'rarely',
      smoking: 'never',
      wants_kids: 'someday',
      interests: ['baking', 'nursing', 'yoga', 'reading', 'gardening', 'board games', 'volunteering', 'dogs'],
      looking_for: 'Someone kind-hearted who values deep conversations and isn\'t afraid of vulnerability. Bonus points if you can appreciate a good sourdough starter and lazy Sunday mornings.',
      life_goals: 'Open a small bakery that doubles as a community space. Continue making a difference in children\'s lives through nursing. Build a loving home filled with laughter, books, and maybe a golden retriever.',
      languages: ['English', 'French'],
      cultural_background: 'Caucasian',
      distance_preference: 30,
      age_preference_min: 28,
      age_preference_max: 42,
      location_city: 'Oakland',
      location_state: 'California'
    });

    console.log('Created User: emma.wilson@example.com / password123');

    // ===== USER 3: DAVID =====
    const davidUser = await User.create({
      email: 'david.chen@example.com',
      password,
      first_name: 'David',
      last_name: 'Chen',
      birthdate: new Date('1990-11-08'),
      gender: 'male',
      looking_for: ['female'],
      looking_for_relationship: 'long-term',
      onboarding_completed: true,
      email_verified: true,
      photos: [
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1488161628813-04466f0fb8fb?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1480429370612-fb23ed73e1b0?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1495366691023-cc4eadcc2d7e?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1528892952291-009c663ce843?w=400&h=500&fit=crop'
      ]
    });

    await Profile.create({
      user_id: davidUser._id,
      bio: 'Software architect who traded Silicon Valley stress for a more balanced life. I code by day, play guitar by night, and spend weekends exploring farmers markets and trying to perfect my ramen recipe. Life\'s too short for bad coffee and boring conversations.',
      height: 137,
      occupation: 'Software Architect',
      education: 'masters',
      religion: 'buddhist',
      drinking: 'socially',
      smoking: 'never',
      wants_kids: 'not-sure',
      interests: ['coding', 'guitar', 'cooking', 'farmers markets', 'coffee', 'technology', 'meditation', 'sci-fi movies'],
      looking_for: 'A genuine connection with someone who appreciates both quiet nights in and spontaneous adventures. Someone curious about life and not afraid to geek out about their passions.',
      life_goals: 'Build meaningful technology that helps people. Learn to play at least one song really well on guitar. Find someone to share lazy Sunday mornings and ambitious travel plans with.',
      languages: ['English', 'Mandarin', 'Japanese'],
      cultural_background: 'Chinese American',
      distance_preference: 40,
      age_preference_min: 26,
      age_preference_max: 38,
      location_city: 'San Jose',
      location_state: 'California'
    });

    console.log('Created User: david.chen@example.com / password123');

    // ===== USER 4: SOPHIA =====
    const sophiaUser = await User.create({
      email: 'sophia.martinez@example.com',
      password,
      first_name: 'Sophia',
      last_name: 'Martinez',
      birthdate: new Date('1994-04-12'),
      gender: 'female',
      looking_for: ['male', 'female'],
      looking_for_relationship: 'long-term',
      onboarding_completed: true,
      email_verified: true,
      photos: [
        'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1464863979621-258859e62245?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1524638431109-93d95c968f03?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1496440737103-cd596325d314?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=400&h=500&fit=crop'
      ]
    });

    await Profile.create({
      user_id: sophiaUser._id,
      bio: 'Art therapist helping others heal through creativity. My apartment is full of plants I\'m trying not to kill, art supplies everywhere, and a very judgmental cat named Frida. I believe everyone has an artist inside them waiting to come out.',
      height: 130,
      occupation: 'Art Therapist',
      education: 'masters',
      religion: 'catholic',
      drinking: 'socially',
      smoking: 'never',
      wants_kids: 'someday',
      interests: ['art therapy', 'painting', 'plants', 'cats', 'museums', 'salsa dancing', 'poetry', 'mental health advocacy'],
      looking_for: 'Looking for someone emotionally intelligent who values growth and isn\'t afraid of deep conversations. Someone who can appreciate both gallery openings and cozy nights painting together.',
      life_goals: 'Open my own art therapy practice. Create a community art space for underserved youth. Find a partner who wants to build a colorful, creative life together.',
      languages: ['English', 'Spanish', 'Portuguese'],
      cultural_background: 'Mexican American',
      distance_preference: 35,
      age_preference_min: 27,
      age_preference_max: 40,
      location_city: 'Berkeley',
      location_state: 'California'
    });

    console.log('Created User: sophia.martinez@example.com / password123');

    // ===== USER 5: JAMES =====
    const jamesUser = await User.create({
      email: 'james.thompson@example.com',
      password,
      first_name: 'James',
      last_name: 'Thompson',
      birthdate: new Date('1987-09-30'),
      gender: 'male',
      looking_for: ['female'],
      looking_for_relationship: 'long-term',
      onboarding_completed: true,
      email_verified: true,
      photos: [
        'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1522556189639-b150ed9c4330?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=400&h=500&fit=crop',
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop'
      ]
    });

    await Profile.create({
      user_id: jamesUser._id,
      bio: 'High school history teacher and amateur woodworker. I get excited about obscure historical facts and perfectly dovetailed joints. My students say I tell the best stories, and my workshop is my happy place. Looking for someone to share life\'s adventures with.',
      height: 142,
      occupation: 'History Teacher',
      education: 'masters',
      religion: 'agnostic',
      drinking: 'socially',
      smoking: 'never',
      wants_kids: 'not-sure',
      interests: ['history', 'woodworking', 'teaching', 'reading', 'hiking', 'board games', 'documentaries', 'craft beer'],
      looking_for: 'Someone intellectually curious who enjoys learning new things. A partner who values education, has a good sense of humor, and doesn\'t mind sawdust on my clothes sometimes.',
      life_goals: 'Write a book about local history. Build furniture that gets passed down through generations. Find a partner who shares my love of learning and creating.',
      languages: ['English'],
      cultural_background: 'Caucasian',
      distance_preference: 45,
      age_preference_min: 28,
      age_preference_max: 42,
      location_city: 'San Francisco',
      location_state: 'California'
    });

    console.log('Created User: james.thompson@example.com / password123');

    const allUsers = [adminUser, emmaUser, davidUser, sophiaUser, jamesUser];

    // ===== CREATE MATCHES =====
    console.log('\nCreating matches...');

    // Match 1: Marcus (admin) and Emma - active conversation
    const match1 = await Match.create({
      users: [adminUser._id, emmaUser._id],
      matched_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
    });

    const match1Messages = [
      { sender: adminUser._id, content: 'Hey Emma! I noticed you\'re into baking - I\'ve been trying to learn myself. Any tips for a complete beginner?' },
      { sender: emmaUser._id, content: 'Hi Marcus! Oh I love that you\'re getting into baking! Start with something forgiving like banana bread - it\'s almost impossible to mess up!' },
      { sender: adminUser._id, content: 'Banana bread sounds perfect! I have some overripe bananas right now actually. Any recipe recommendations?' },
      { sender: emmaUser._id, content: 'Yes! I have my grandmother\'s recipe that never fails. The secret is brown butter and a touch of cinnamon. I could share it with you!' },
      { sender: adminUser._id, content: 'That sounds amazing! I\'d love that. Maybe we could bake together sometime? I promise not to burn down the kitchen.' },
      { sender: emmaUser._id, content: 'Haha! I\'d like that. How about this Saturday? I could bring the ingredients and walk you through it.' },
    ];

    let msgTime = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    for (const msg of match1Messages) {
      await Message.create({
        match_id: match1._id,
        sender_id: msg.sender,
        content: msg.content,
        created_at: msgTime
      });
      msgTime = new Date(msgTime.getTime() + 2 * 60 * 60 * 1000);
    }

    match1.last_message = match1Messages[match1Messages.length - 1].content;
    match1.last_message_at = msgTime;
    match1.last_message_sender = emmaUser._id;
    match1.unread_counts = new Map([[adminUser._id.toString(), 1]]);
    await match1.save();

    // Match 2: David and Sophia - new match
    const match2 = await Match.create({
      users: [davidUser._id, sophiaUser._id],
      matched_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
    });

    const match2Messages = [
      { sender: davidUser._id, content: 'Hi Sophia! Your profile caught my eye - I love that you\'re an art therapist. That sounds like such meaningful work.' },
      { sender: sophiaUser._id, content: 'Thank you David! It\'s incredibly rewarding. I see you\'re into meditation - have you ever tried combining it with art?' },
      { sender: davidUser._id, content: 'I haven\'t but that sounds fascinating! I\'d love to hear more about that.' },
    ];

    msgTime = new Date(Date.now() - 20 * 60 * 60 * 1000);
    for (const msg of match2Messages) {
      await Message.create({
        match_id: match2._id,
        sender_id: msg.sender,
        content: msg.content,
        created_at: msgTime
      });
      msgTime = new Date(msgTime.getTime() + 3 * 60 * 60 * 1000);
    }

    match2.last_message = match2Messages[match2Messages.length - 1].content;
    match2.last_message_at = msgTime;
    match2.last_message_sender = davidUser._id;
    match2.unread_counts = new Map([[sophiaUser._id.toString(), 1]]);
    await match2.save();

    // Match 3: James and Emma - longer conversation
    const match3 = await Match.create({
      users: [jamesUser._id, emmaUser._id],
      matched_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
    });

    const match3Messages = [
      { sender: jamesUser._id, content: 'Hi Emma! I noticed we\'re both into board games. Do you have a favorite?' },
      { sender: emmaUser._id, content: 'Hey James! I\'m a big Settlers of Catan fan, but lately I\'ve been obsessed with Wingspan. You?' },
      { sender: jamesUser._id, content: 'Wingspan is amazing! I love the artwork. I\'m more of a strategy game person - Terraforming Mars is my current obsession.' },
      { sender: emmaUser._id, content: 'I\'ve heard great things about that one but never tried it. Is it hard to learn?' },
      { sender: jamesUser._id, content: 'It has a bit of a learning curve but it\'s so worth it! I\'d be happy to teach you sometime if you\'re interested.' },
    ];

    msgTime = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    for (const msg of match3Messages) {
      await Message.create({
        match_id: match3._id,
        sender_id: msg.sender,
        content: msg.content,
        created_at: msgTime
      });
      msgTime = new Date(msgTime.getTime() + 4 * 60 * 60 * 1000);
    }

    match3.last_message = match3Messages[match3Messages.length - 1].content;
    match3.last_message_at = msgTime;
    match3.last_message_sender = jamesUser._id;
    match3.unread_counts = new Map([[emmaUser._id.toString(), 1]]);
    await match3.save();

    console.log('Created 3 matches with conversations');

    // ===== CREATE LIKES =====
    console.log('\nCreating likes...');

    // Likes that led to matches (mutual)
    await Like.create({ from_user: adminUser._id, to_user: emmaUser._id, type: 'like', created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) });
    await Like.create({ from_user: emmaUser._id, to_user: adminUser._id, type: 'like', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
    
    await Like.create({ from_user: davidUser._id, to_user: sophiaUser._id, type: 'superlike', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) });
    await Like.create({ from_user: sophiaUser._id, to_user: davidUser._id, type: 'like', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) });
    
    await Like.create({ from_user: jamesUser._id, to_user: emmaUser._id, type: 'like', created_at: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000) });
    await Like.create({ from_user: emmaUser._id, to_user: jamesUser._id, type: 'like', created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) });

    // Pending likes (not yet mutual)
    await Like.create({ from_user: jamesUser._id, to_user: sophiaUser._id, type: 'like', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) });
    await Like.create({ from_user: adminUser._id, to_user: sophiaUser._id, type: 'like', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) });
    await Like.create({ from_user: davidUser._id, to_user: emmaUser._id, type: 'superlike', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) });

    console.log('Created likes (including pending ones)');

    // ===== CREATE EVENTS =====
    console.log('\nCreating events...');

    const event1 = await Event.create({
      title: 'Bay Area LPA Monthly Mixer',
      description: 'Join us for our monthly social mixer! This is a great opportunity to meet fellow LPA members in a casual, welcoming environment. Light refreshments will be provided. First-time attendees welcome!',
      image: 'https://images.unsplash.com/photo-1529543544277-750e85f519be?w=600&h=400&fit=crop',
      start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      location: 'Community Center, 456 Main St, San Francisco, CA',
      category: 'local-chapter',
      max_attendees: 40,
      created_by: adminUser._id,
      attendees: [adminUser._id, emmaUser._id, davidUser._id]
    });

    const event2 = await Event.create({
      title: 'Hiking at Muir Woods',
      description: 'Explore the majestic redwoods with fellow LPA members! This is a moderate 3-mile hike suitable for most fitness levels. Please wear comfortable shoes and bring water. We\'ll stop for lunch afterwards at a nearby cafe.',
      image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&h=400&fit=crop',
      start_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000),
      location: 'Muir Woods National Monument, Mill Valley, CA',
      category: 'regional',
      max_attendees: 20,
      created_by: adminUser._id,
      attendees: [jamesUser._id, sophiaUser._id]
    });

    const event3 = await Event.create({
      title: 'Wine Tasting in Napa Valley',
      description: 'A sophisticated afternoon of wine tasting at three premium Napa Valley wineries. Transportation provided from San Francisco. Must be 21+ to attend. Includes wine flights and cheese pairings.',
      image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&h=400&fit=crop',
      start_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      end_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000),
      location: 'Napa Valley Wine Country, CA',
      category: 'regional',
      max_attendees: 30,
      created_by: adminUser._id,
      attendees: [emmaUser._id, davidUser._id, sophiaUser._id]
    });

    const event4 = await Event.create({
      title: 'LPA National Conference 2026',
      description: 'The biggest LPA event of the year! Three days of workshops, networking, advocacy training, and celebration. Keynote speakers, breakout sessions, and our famous Saturday night gala. Early bird registration now open!',
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop',
      start_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      end_date: new Date(Date.now() + 63 * 24 * 60 * 60 * 1000),
      location: 'Marriott Convention Center, Orlando, FL',
      category: 'national',
      max_attendees: 500,
      created_by: adminUser._id,
      attendees: [adminUser._id]
    });

    const event5 = await Event.create({
      title: 'Game Night at Dave & Buster\'s',
      description: 'Let\'s have some fun! Join us for an evening of arcade games, bowling, and friendly competition. Great for meeting new people in a relaxed setting. All skill levels welcome - we\'re here to have fun, not to win!',
      image: 'https://images.unsplash.com/photo-1511882150382-421056c89033?w=600&h=400&fit=crop',
      start_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      location: 'Dave & Buster\'s, Milpitas, CA',
      category: 'local-chapter',
      max_attendees: 25,
      created_by: adminUser._id,
      attendees: [jamesUser._id, emmaUser._id]
    });

    const event6 = await Event.create({
      title: 'Art Workshop: Watercolor Basics',
      description: 'Discover your inner artist! This beginner-friendly workshop will teach you watercolor fundamentals. All supplies provided. Led by local artist and LPA member Sophia Martinez. No experience necessary!',
      image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&h=400&fit=crop',
      start_date: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
      end_date: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      location: 'Berkeley Art Studio, Berkeley, CA',
      category: 'local-chapter',
      max_attendees: 15,
      created_by: sophiaUser._id,
      attendees: [sophiaUser._id, davidUser._id]
    });

    console.log('Created 6 events');

    // ===== CREATE NOTIFICATIONS =====
    console.log('\nCreating notifications...');

    // Notifications for Admin user
    await Notification.create({
      user_id: adminUser._id,
      type: 'message',
      title: 'New Message',
      message: 'Emma sent you a message',
      avatar: emmaUser.photos[0],
      related_user: emmaUser._id,
      related_match: match1._id,
      read: false
    });

    await Notification.create({
      user_id: adminUser._id,
      type: 'like',
      title: 'Someone Likes You',
      message: 'Someone new liked your profile!',
      read: false
    });

    await Notification.create({
      user_id: adminUser._id,
      type: 'event',
      title: 'Event Reminder',
      message: 'Bay Area LPA Monthly Mixer is coming up in 7 days!',
      read: true
    });

    // Notifications for Emma
    await Notification.create({
      user_id: emmaUser._id,
      type: 'match',
      title: 'New Match!',
      message: 'You and Marcus matched!',
      avatar: adminUser.photos[0],
      related_user: adminUser._id,
      related_match: match1._id,
      read: true
    });

    await Notification.create({
      user_id: emmaUser._id,
      type: 'like',
      title: 'Someone Likes You',
      message: 'David superliked your profile!',
      avatar: davidUser.photos[0],
      related_user: davidUser._id,
      read: false
    });

    // Notifications for David
    await Notification.create({
      user_id: davidUser._id,
      type: 'match',
      title: 'New Match!',
      message: 'You and Sophia matched! Start a conversation.',
      avatar: sophiaUser.photos[0],
      related_user: sophiaUser._id,
      related_match: match2._id,
      read: true
    });

    // Notifications for Sophia
    await Notification.create({
      user_id: sophiaUser._id,
      type: 'message',
      title: 'New Message',
      message: 'David sent you a message',
      avatar: davidUser.photos[0],
      related_user: davidUser._id,
      related_match: match2._id,
      read: false
    });

    await Notification.create({
      user_id: sophiaUser._id,
      type: 'like',
      title: 'Someone Likes You',
      message: 'You have 2 new likes!',
      read: false
    });

    // Notifications for James
    await Notification.create({
      user_id: jamesUser._id,
      type: 'news',
      title: 'D8-LPA News',
      message: 'Check out our new Art Workshop event! Perfect for creative souls.',
      read: false
    });

    await Notification.create({
      user_id: jamesUser._id,
      type: 'event',
      title: 'Event Reminder',
      message: 'Hiking at Muir Woods is coming up! Don\'t forget to bring water.',
      read: true
    });

    console.log('Created notifications for all users');

    // ===== SUMMARY =====
    console.log('\n========================================');
    console.log('Database seeded successfully!');
    console.log('========================================');
    console.log('\nTest Accounts:');
    console.log('----------------------------------------');
    console.log('Admin:   admin@d8lpa.com / admin123');
    console.log('User 1:  emma.wilson@example.com / password123');
    console.log('User 2:  david.chen@example.com / password123');
    console.log('User 3:  sophia.martinez@example.com / password123');
    console.log('User 4:  james.thompson@example.com / password123');
    console.log('----------------------------------------');
    console.log('\nData Created:');
    console.log('- 5 Users with complete profiles (10 photos each)');
    console.log('- 3 Matches with conversations');
    console.log('- 9 Likes (including pending)');
    console.log('- 6 Events');
    console.log('- 10 Notifications');
    console.log('========================================\n');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedDatabase();
