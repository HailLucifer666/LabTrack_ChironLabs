# Client update email draft

**Subject:** LabTrack demo update

Hi Maria,

I’ve made the case dashboard easier to scan, corrected how calendar due dates are handled so they don’t shift when viewed from another time zone, and added a case-ready email workflow.

The current build is using **demo/test mode**: the case edits are stored in the current browser, and the email feature creates a preview rather than delivering a message to a real clinic. To use this with shared data and real email, I still need the database and email-provider configuration.

I haven’t added WhatsApp yet because email was the agreed first step and it lets us validate the workflow sooner. Before using this with real clinics, please confirm which time zone should govern overdue cases, which clinic contact should receive each email, and the preferred sender/message wording.

Thanks,  
[Your name]

> Before sending, update this draft to match the actual deployed configuration and features. Do not claim live email delivery or persistent shared storage unless you have configured and tested them.
