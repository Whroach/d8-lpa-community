import { Separator } from "@/components/ui/separator"

/**
 * The Terms of Service and Privacy Policy text, shown in Settings and on the
 * public /terms page (which the sign-up form links to).
 */
export function TermsContent() {
  return (
    <div className="space-y-6 py-4">
      {/* Terms of Service */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Terms of Service</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Welcome to D8-LPA Community. By accessing and using this platform, you agree to be bound by these terms and conditions.
          </p>
          <div>
            <h4 className="font-medium text-foreground mb-1">1. User Conduct</h4>
            <p>
              Users agree to use the platform respectfully and lawfully. Any form of harassment, discrimination, or abusive behavior is strictly prohibited.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">2. Content Responsibility</h4>
            <p>
              You are responsible for all content you post. We reserve the right to remove content that violates our guidelines or applicable laws.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">3. Account Security</h4>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized access.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">4. Limitation of Liability</h4>
            <p>
              D8-LPA Community is provided "as is" without warranties. We are not liable for any indirect, incidental, special, or consequential damages.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">5. Termination</h4>
            <p>
              We reserve the right to terminate or suspend accounts that violate these terms without prior notice.
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Privacy Policy */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Privacy Policy</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Your privacy is important to us. This policy outlines how we collect, use, and protect your information.
          </p>
          <div>
            <h4 className="font-medium text-foreground mb-1">1. Information Collection</h4>
            <p>
              We collect information you provide directly (profile data, photos, preferences) and information collected automatically (device information, usage analytics).
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">2. Data Usage</h4>
            <p>
              Your data is used to provide, improve, and personalize our services. We do not sell or share your personal information with third parties without consent.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">3. Security Measures</h4>
            <p>
              We implement industry-standard security measures to protect your information from unauthorized access, alteration, and destruction.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">4. Cookies & Tracking</h4>
            <p>
              We use cookies and similar technologies to enhance your experience. You can control cookie settings through your browser.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">5. Your Rights</h4>
            <p>
              You have the right to access, correct, or delete your personal information. Contact us for any privacy-related requests.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">6. Contact Us</h4>
            <p>
              For privacy inquiries, please contact us at d8lpa.community@gmail.com
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Last Updated */}
      <p className="text-xs text-muted-foreground text-center">
        Last updated: February 2026
      </p>
    </div>
  )
}
