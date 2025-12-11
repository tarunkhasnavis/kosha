# Email Sync Worker

Automated Gmail email synchronization for order processing.

## How It Works

1. **Cron Job** triggers `/api/cron/email-sync` every 5 minutes
2. **Worker** fetches all organizations with Gmail connected
3. For each organization:
   - Fetch recent emails from Gmail
   - Check if already processed (idempotency)
   - Run AI extraction (only for new emails)
   - Create or update orders
   - Save audit trail

## Setup

### 1. Add CRON_SECRET to environment variables

```bash
# .env.local
CRON_SECRET=your-secret-key-here
```

### 2. Deploy to Vercel

The `vercel.json` file is already configured to run the cron job every 5 minutes.

### 3. Manual Testing

You can manually trigger the sync:

```bash
curl http://localhost:3000/api/cron/email-sync \
  -H "Authorization: Bearer your-secret-key-here"
```

## File Structure

```
lib/workers/
  └── emailSync.ts           # Main sync logic

app/api/cron/email-sync/
  └── route.ts               # API endpoint for cron

vercel.json                  # Cron schedule configuration
```

## Cost Optimization

- **Idempotency check BEFORE AI**: Duplicate emails don't cost OpenAI API calls
- **Incremental sync**: Uses `gmail_last_history_id` (TODO: implement)
- **Batch processing**: Processes multiple emails in one run

## Monitoring

Check logs in Vercel dashboard:
- Deployments → Functions → `/api/cron/email-sync`
- Look for: "Processed X emails across Y organizations"

## Future: Migrate to Pub/Sub

When ready for real-time:
1. Set up Google Cloud Pub/Sub
2. Create webhook endpoint
3. Gmail pushes notifications instead of polling
4. Same `handleEmailOrder()` logic - zero code changes!

## Troubleshooting

**No emails being processed?**
- Check `organizations.gmail_email` is set
- Check user's OAuth token is valid (may need re-auth)
- Check logs for errors

**Duplicate orders?**
- Should never happen due to idempotency check
- Check `order_emails.gmail_message_id` uniqueness

**OpenAI costs too high?**
- Idempotency check should prevent re-processing
- Check logs for "already_processed" messages
