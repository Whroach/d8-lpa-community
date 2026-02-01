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

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://lpa-d8:Qd1gXd48ljTQDzGP3477UeNrlQrdRjhG7eXpQ@cluster0.iogpu.mongodb.net/d8lpa?retryWrites=true&w=majority&appName=Cluster0';

const seedAdditionalProfiles = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const password = 'password123';

    // Helper arrays for random data
    const maleFirstNames = ['James', 'Michael', 'David', 'Christopher', 'Daniel', 'Matthew', 'Anthony'];
    const femaleFirstNames = ['Emily', 'Sarah', 'Jessica', 'Ashley', 'Amanda', 'Melissa', 'Stephanie', 'Nicole'];
    const lastNames = ['Johnson', 'Smith', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin'];
    
    const cities = [
      { city: 'New York', state: 'New York' },
      { city: 'Los Angeles', state: 'California' },
      { city: 'Chicago', state: 'Illinois' },
      { city: 'Houston', state: 'Texas' },
      { city: 'Phoenix', state: 'Arizona' },
      { city: 'Seattle', state: 'Washington' },
      { city: 'Denver', state: 'Colorado' },
      { city: 'Boston', state: 'Massachusetts' },
      { city: 'Atlanta', state: 'Georgia' },
      { city: 'Miami', state: 'Florida' },
      { city: 'Portland', state: 'Oregon' },
      { city: 'Austin', state: 'Texas' },
      { city: 'San Diego', state: 'California' },
      { city: 'Dallas', state: 'Texas' },
      { city: 'Philadelphia', state: 'Pennsylvania' }
    ];

    const occupations = [
      'Software Engineer', 'Teacher', 'Nurse', 'Marketing Manager', 'Graphic Designer',
      'Accountant', 'Sales Representative', 'Physical Therapist', 'Web Developer',
      'Project Manager', 'HR Specialist', 'Data Analyst', 'Chef', 'Architect', 'Photographer'
    ];

    const interestsList = [
      'hiking', 'photography', 'cooking', 'reading', 'travel', 'yoga', 'painting',
      'music', 'dancing', 'fitness', 'movies', 'coffee', 'wine', 'gaming', 'sports',
      'volunteering', 'writing', 'camping', 'cycling', 'meditation'
    ];

    const bios = [
      'Adventurous spirit who loves exploring new places and trying new cuisines. Always up for spontaneous road trips and outdoor adventures.',
      'Creative soul with a passion for art and design. I find beauty in the little things and love sharing experiences with genuine people.',
      'Fitness enthusiast and foodie - yes, I balance both! Looking for someone who enjoys an active lifestyle and good conversation.',
      'Music lover and concert-goer. Love discovering new artists and sharing playlists. Life is better with a good soundtrack.',
      'Book nerd and coffee addict. You\'ll usually find me in a cozy café or exploring local bookstores on weekends.',
      'Outdoor enthusiast who loves hiking, camping, and all things nature. Let\'s plan our next adventure together!',
      'Passionate about making a difference in my community. Love volunteering, cooking for friends, and deep conversations.',
      'Tech geek with a creative side. I code by day and paint by night. Looking for someone who appreciates both logic and art.',
      'Yoga instructor and wellness advocate. Believe in living mindfully and finding balance in all aspects of life.',
      'Foodie on a mission to try every restaurant in town. Love cooking experiments and wine tastings.',
      'Sports fanatic and weekend warrior. Whether it\'s playing or watching, I\'m all about that competitive spirit.',
      'Travel blogger and photography enthusiast. My passport is my most prized possession, and I\'m always planning the next trip.',
      'Animal lover and rescue advocate. My weekends involve long walks, dog parks, and volunteering at the shelter.',
      'Film buff and aspiring screenwriter. Love discussing movies over popcorn and debating the best directors of all time.',
      'Entrepreneur and go-getter. Building my dreams one day at a time and looking for someone who supports ambition.'
    ];

    // Nature/landscape photos for variety
    const naturePhotos = [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=500&fit=crop', // mountain landscape
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=500&fit=crop', // forest
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=500&fit=crop', // sunset
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&h=500&fit=crop', // mountains
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=500&fit=crop', // nature trail
      'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=400&h=500&fit=crop', // alps
      'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&h=500&fit=crop', // beach
      'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=400&h=500&fit=crop', // waterfall
      'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=400&h=500&fit=crop', // flower field
      'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=400&h=500&fit=crop', // lake
      'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=400&h=500&fit=crop', // mountain peak
      'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400&h=500&fit=crop', // ocean
      'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=400&h=500&fit=crop', // lake sunset
      'https://images.unsplash.com/photo-1482192505345-5655af888cc4?w=400&h=500&fit=crop', // trees
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=500&fit=crop', // mountain valley
    ];

    // Profile photos - males
    const malePhotos = [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop',
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=500&fit=crop',
      'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&h=500&fit=crop',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=500&fit=crop',
      'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=500&fit=crop',
    ];

    // Profile photos - females
    const femalePhotos = [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=500&fit=crop',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop',
      'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=500&fit=crop',
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=500&fit=crop',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=500&fit=crop',
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=500&fit=crop',
      'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=500&fit=crop',
    ];

    const getRandomItems = (arr, count) => {
      const shuffled = [...arr].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    };

    const getRandomPhotos = (profilePhoto, count = 6) => {
      const photos = [profilePhoto];
      const additionalPhotos = getRandomItems(naturePhotos, count);
      return [...photos, ...additionalPhotos];
    };

    console.log('Creating 7 male profiles...');
    
    // Create 7 male profiles
    for (let i = 0; i < 7; i++) {
      const firstName = maleFirstNames[i];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const location = cities[Math.floor(Math.random() * cities.length)];
      const age = 25 + Math.floor(Math.random() * 15); // 25-39
      const birthYear = new Date().getFullYear() - age;
      const profilePhoto = malePhotos[i];
      
      const user = await User.create({
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        password: password,
        first_name: firstName,
        last_name: lastName,
        birthdate: new Date(birthYear, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        gender: 'male',
        looking_for: ['female'],
        looking_for_relationship: ['long-term', 'short-term', 'casual'][Math.floor(Math.random() * 3)],
        onboarding_completed: true,
        email_verified: true,
        photos: getRandomPhotos(profilePhoto, 6)
      });

      await Profile.create({
        user_id: user._id,
        bio: bios[Math.floor(Math.random() * bios.length)],
        height: 140 + Math.floor(Math.random() * 15), // 140-154 cm
        occupation: occupations[Math.floor(Math.random() * occupations.length)],
        education: ['bachelors', 'masters', 'some-college', 'high-school'][Math.floor(Math.random() * 4)],
        religion: ['christian', 'catholic', 'jewish', 'spiritual', 'atheist', 'agnostic'][Math.floor(Math.random() * 6)],
        drinking: ['never', 'rarely', 'socially'][Math.floor(Math.random() * 3)],
        smoking: ['never', 'socially'][Math.floor(Math.random() * 2)],
        wants_kids: ['yes', 'have-kids', 'no', 'not-sure'][Math.floor(Math.random() * 4)],
        interests: getRandomItems(interestsList, 5 + Math.floor(Math.random() * 5)),
        looking_for_description: 'Looking for someone genuine to share life\'s adventures with.',
        life_goals: 'Build a fulfilling career, travel the world, and create meaningful connections.',
        languages: ['English'],
        cultural_background: 'American',
        distance_preference: 25 + Math.floor(Math.random() * 50),
        age_preference_min: 22 + Math.floor(Math.random() * 5),
        age_preference_max: 35 + Math.floor(Math.random() * 15),
        location_city: location.city,
        location_state: location.state
      });

      console.log(`  Created male profile: ${firstName} ${lastName}`);
    }

    console.log('Creating 8 female profiles...');
    
    // Create 8 female profiles
    for (let i = 0; i < 8; i++) {
      const firstName = femaleFirstNames[i];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const location = cities[Math.floor(Math.random() * cities.length)];
      const age = 25 + Math.floor(Math.random() * 15); // 25-39
      const birthYear = new Date().getFullYear() - age;
      const profilePhoto = femalePhotos[i];
      
      const user = await User.create({
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        password: password,
        first_name: firstName,
        last_name: lastName,
        birthdate: new Date(birthYear, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        gender: 'female',
        looking_for: ['male'],
        looking_for_relationship: ['long-term', 'short-term', 'casual'][Math.floor(Math.random() * 3)],
        onboarding_completed: true,
        email_verified: true,
        photos: getRandomPhotos(profilePhoto, 6)
      });

      await Profile.create({
        user_id: user._id,
        bio: bios[Math.floor(Math.random() * bios.length)],
        height: 135 + Math.floor(Math.random() * 15), // 135-149 cm
        occupation: occupations[Math.floor(Math.random() * occupations.length)],
        education: ['bachelors', 'masters', 'some-college', 'high-school'][Math.floor(Math.random() * 4)],
        religion: ['christian', 'catholic', 'jewish', 'spiritual', 'atheist', 'agnostic'][Math.floor(Math.random() * 6)],
        drinking: ['never', 'rarely', 'socially'][Math.floor(Math.random() * 3)],
        smoking: ['never', 'socially'][Math.floor(Math.random() * 2)],
        wants_kids: ['yes', 'have-kids', 'no', 'not-sure'][Math.floor(Math.random() * 4)],
        interests: getRandomItems(interestsList, 5 + Math.floor(Math.random() * 5)),
        looking_for_description: 'Looking for someone who values authenticity and meaningful connection.',
        life_goals: 'Continue personal growth, pursue my passions, and build lasting relationships.',
        languages: ['English'],
        cultural_background: 'American',
        distance_preference: 25 + Math.floor(Math.random() * 50),
        age_preference_min: 24 + Math.floor(Math.random() * 5),
        age_preference_max: 38 + Math.floor(Math.random() * 12),
        location_city: location.city,
        location_state: location.state
      });

      console.log(`  Created female profile: ${firstName} ${lastName}`);
    }

    console.log('\n✅ Successfully created 15 additional profiles (7 male, 8 female)');
    console.log('All users have password: password123');
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedAdditionalProfiles();
