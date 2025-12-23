# Azure Redis Cache - Troubleshooting Connection Issues

## Common Issues and Solutions

### 1. DNS Resolution Failed (Error 11001)

**Symptom:**
```
Error 11001 connecting to TopicsFlow.redis.cache.windows.net:6380. getaddrinfo failed.
```

**Possible Causes:**
- DNS cannot resolve the hostname
- Incorrect Redis Cache name
- Network connectivity issues

**Solutions:**

1. **Verify Redis Cache Name**
   - Go to Azure Portal → Your Redis Cache
   - Check the exact name in "Properties" or "Overview"
   - The format should be: `{name}.redis.cache.windows.net`

2. **Test DNS Resolution**
   ```bash
   # Test with Google DNS
   nslookup TopicsFlow.redis.cache.windows.net 8.8.8.8
   
   # Or use ping (will fail but shows if DNS resolves)
   ping TopicsFlow.redis.cache.windows.net
   ```

3. **Check Firewall Rules**
   - Ensure "AllowAll" rule (0.0.0.0 - 255.255.255.255) is saved
   - Wait a few minutes for changes to propagate

4. **Verify Connection String**
   - Get the connection string from Azure Portal:
     - Redis Cache → "Access keys" or "Connection strings"
   - Format: `{host}:{port},password={password},ssl=True`

### 2. Connection Timeout

**Symptom:**
```
Connection timeout after 5 seconds
```

**Solutions:**
- Check if your IP is whitelisted (if not using AllowAll)
- Verify SSL is enabled (port 6380) or disabled (port 6379)
- Check network firewall/antivirus blocking outbound connections

### 3. Authentication Failed

**Symptom:**
```
Authentication failed: invalid password
```

**Solutions:**
- Regenerate access keys in Azure Portal
- Verify password in connection string matches the key
- Check for extra spaces or encoding issues

### 4. Testing from Azure App Service

If testing from Azure App Service (not local):
- Use the same connection string
- No firewall rules needed if both are in Azure
- Check App Service → Networking → Outbound IPs if using specific rules

### Getting Connection String from Azure Portal

1. Go to your Redis Cache in Azure Portal
2. Click **"Access keys"** in the left menu
3. Copy the **"Primary connection string"** or **"StackExchange.Redis"** format
4. It should look like:
   ```
   TopicsFlow.redis.cache.windows.net:6380,password=...,ssl=True,abortConnect=False
   ```

### Testing Connection

```bash
# Test with script
python backend/scripts/test_redis_connection.py "your-connection-string"

# Or parse only
python backend/scripts/test_redis_connection.py --parse-only "your-connection-string"
```

