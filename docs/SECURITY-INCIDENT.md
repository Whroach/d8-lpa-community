# Security checklist: the exposed database password and admin passwords

**Who this is for:** the owner. Only you can do these steps - they need your MongoDB Atlas, Railway and GitHub logins. Nothing here was done for you, and no secret values appear in this file.

**What happened.** This repository is public. Older commits contain the production MongoDB connection string (including the database user's password) and passwords for admin accounts. The files were cleaned on the `improvements/2026-10-04` branch, but **old commits keep the old contents forever**, so anyone who looked could have copied them. Treat the database password and those admin passwords as known to strangers until you have changed them.

Do the steps in this order. Steps 1 and 2 matter most; allow about 30 minutes for them. Tick each box as you go.

---

## Step 1 - Change the database password (MongoDB Atlas) and tell Railway

This is the important one: with the old password a stranger can read and change every member's data.

- [ ] 1.1 Sign in at <https://cloud.mongodb.com> and open the project that holds the D8-LPA cluster.
- [ ] 1.2 Left menu: **Security > Database Access**. Find the database user the app uses (the user name is the part before the `:` in the `MONGODB_URI` variable in Railway).
- [ ] 1.3 Click **Edit** on that user, then **Edit Password > Autogenerate Secure Password**. Click **Copy**. Do not click "Update User" yet - first paste the password somewhere safe for the next ten minutes (a password manager entry is best; not an email, not a chat message, not a file in this repository).
- [ ] 1.4 Click **Update User**. From this moment the live site cannot reach the database until step 1.6 is done, so do the next two steps straight away. Members will see errors for a minute or two; nothing is lost.
- [ ] 1.5 Open <https://railway.app>, open the D8-LPA project, click the **API service** (the one that runs the server), then the **Variables** tab. Open `MONGODB_URI` and replace only the password part - the text between the second `:` and the `@`. If the new password contains any of `@ : / ? # [ ] %`, generate another one in Atlas instead (those characters need special encoding and are an easy way to break the connection). Save.
- [ ] 1.6 Railway redeploys by itself after a variable change (if it does not, press **Deploy**). Wait for the deployment to show **Active**.
- [ ] 1.7 Check the site: open it, sign in, open Browse and Messages. Also open `https://<your API address>/api/health` - it should answer without an error.
- [ ] 1.8 If any other place uses the same connection string (a second Railway service, a scheduled job, your own computer's `.env` file), update it there too.
- [ ] 1.9 While you are in **Database Access**: delete any database users you do not recognise or no longer need.

## Step 2 - Look for signs that someone else used the old password

- [ ] 2.1 Atlas, left menu: **Security > Network Access**. Note what is listed. If it says `0.0.0.0/0` ("allow access from anywhere"), that is how Railway is usually allowed in, but it also means the password was the only lock - which is why step 1 is urgent. Remove any address you do not recognise.
- [ ] 2.2 Atlas: open the project's **Activity Feed** (the clock icon at the top right of the project, or **Project > Activity Feed**). Look back as far as it goes for things you did not do: database users created or changed, network access changed, clusters paused, backups downloaded, data exported.
- [ ] 2.3 Atlas: open the cluster, then **Monitoring** (Metrics). Look at **Connections** and **Network** over the last weeks for spikes at times when the site was quiet - a large jump in data sent *out* can mean a copy was taken.
- [ ] 2.4 Access logs. On paid cluster tiers (M10 and above): cluster **... > View Database Access History** lists each sign-in to the database with its IP address - look for addresses that are not Railway. On the free and shared tiers this list is not available; say so in your notes and rely on 2.2, 2.3 and 2.5.
- [ ] 2.5 Atlas: **Browse Collections**. Look for anything that should not be there - a collection with a strange name, a "read me to get your data back" note (a common sign of an automated attack), admin accounts in `users` (`role: "admin"`) that you did not create, or member counts that have dropped.
- [ ] 2.6 Write down what you found, with dates. **If anything looks wrong** - unknown connections, missing or changed data, a ransom note, unknown admin accounts - members' personal data may have been seen by someone else. In that case: restore from an Atlas backup if data was changed, tell your LPA district leadership, and take advice on telling members and on any legal duty to report a data breach where your members live. Do not delete the evidence.

## Step 3 - Change the admin passwords

The old commits contained passwords for admin accounts, and an old setup script created an admin with a weak, fixed password.

- [ ] 3.1 List every admin: sign in to the site as an admin and open **Admin > Users**, filter by role "admin" (or in Atlas, `users` collection, filter `{ "role": "admin" }`).
- [ ] 3.2 For each admin account that is a real person: ask them to sign in and go to **Settings > Change password**, choosing a new password they use nowhere else. Do your own first.
- [ ] 3.3 For each admin account nobody recognises or uses - in particular one created by the old setup script (the address is in the pull request description) - remove its admin role or ban it from the Admin screen.
- [ ] 3.4 If an admin cannot sign in, use **Forgot password** on the login screen rather than any script.
- [ ] 3.5 Any admin who used the same password anywhere else should change it there too.

## Step 4 - Change `JWT_SECRET` (the key that signs sign-ins)

Do this if the secret was ever written in a file in the repository, sent in a message, or if step 2 turned up anything suspicious. If you are not sure, do it - the cost is small.

- [ ] 4.1 Make a new secret: a long random value, at least 64 characters. In PowerShell: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Copy the output; do not save it in a file in the repository.
- [ ] 4.2 Railway > API service > **Variables** > `JWT_SECRET` > paste the new value > save, and let it redeploy.
- [ ] 4.3 **What members will notice:** everyone is signed out once, on every device, and sees the login screen the next time they open the app. They sign in again with the same email and password. Nothing else changes - no messages, matches or settings are lost. Pick a quiet time, and consider posting an announcement beforehand ("You may be asked to sign in again this evening - that is expected").
- [ ] 4.4 Sign in yourself afterwards to confirm it works.

## Step 5 - Make the repository private

Cleaning the files does not clean the history; making the repository private stops new people from reading it.

- [ ] 5.1 GitHub > the repository > **Settings > General**, scroll to **Danger Zone > Change repository visibility > Change to private**. Confirm.
- [ ] 5.2 Railway deploys from GitHub: after the change, check Railway still shows the repository as connected (Railway > service > **Settings > Source**). If it lost access, reconnect it.
- [ ] 5.3 Forks and copies made while it was public stay public - which is why steps 1 to 4 are still needed even after this.
- [ ] 5.4 Optional, later: the secrets can be removed from history by rewriting it (or by creating a fresh repository from the current code). That is tidy-up, not protection - once the passwords are changed, the old ones in history are useless.

## Step 6 - While you are there

- [ ] 6.1 Other keys that live beside the database address in Railway (AWS S3 access key, Mailgun API key): they were not found in the repository's history, but if they were ever shared the same way as the database address, rotate them too - AWS: **IAM > Users > Security credentials > Create access key**, update `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in Railway, then deactivate the old key; Mailgun: **API Security > Add new key**, update Railway, delete the old key.
- [ ] 6.2 Turn on two-step sign-in for your MongoDB Atlas, Railway, GitHub, AWS and Mailgun accounts if it is not on already.
- [ ] 6.3 Turn on GitHub's **secret scanning** and **push protection** for the repository (**Settings > Code security**) so a password cannot be committed by accident again.
- [ ] 6.4 Keep real values only in Railway's Variables and in a `.env` file on your own computer. `.env` files are already ignored by git in this repository.

---

### When you are done

| Step | Done on (date) | Notes |
|---|---|---|
| 1 Database password changed, Railway updated, site checked | | |
| 2 Atlas activity and access reviewed | | |
| 3 Admin passwords changed, unknown admins removed | | |
| 4 `JWT_SECRET` changed (members signed out once) | | |
| 5 Repository made private | | |
| 6 Other keys, two-step sign-in, secret scanning | | |
