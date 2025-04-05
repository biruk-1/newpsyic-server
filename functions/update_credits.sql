-- Function to add credits to a user's balance
CREATE OR REPLACE FUNCTION add_user_credits(amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_balance INTEGER;
    new_balance INTEGER;
BEGIN
    -- Get current balance with row lock
    SELECT credits_balance INTO current_balance
    FROM users
    WHERE id = auth.uid()
    FOR UPDATE;

    -- Calculate new balance
    new_balance := current_balance + amount;

    -- Update balance
    UPDATE users
    SET credits_balance = new_balance,
        updated_at = NOW()
    WHERE id = auth.uid();

    -- Return new balance
    RETURN new_balance;
END;
$$;

-- Function to deduct credits from a user's balance
CREATE OR REPLACE FUNCTION deduct_user_credits(amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_balance INTEGER;
    new_balance INTEGER;
BEGIN
    -- Get current balance with row lock
    SELECT credits_balance INTO current_balance
    FROM users
    WHERE id = auth.uid()
    FOR UPDATE;

    -- Check if user has enough credits
    IF current_balance < amount THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;

    -- Calculate new balance
    new_balance := current_balance - amount;

    -- Update balance
    UPDATE users
    SET credits_balance = new_balance,
        updated_at = NOW()
    WHERE id = auth.uid();

    -- Return new balance
    RETURN new_balance;
END;
$$;

-- Create a trigger to log credit changes
CREATE OR REPLACE FUNCTION log_credit_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.credits_balance != NEW.credits_balance THEN
        INSERT INTO credit_transactions (
            user_id,
            amount,
            previous_balance,
            new_balance,
            transaction_type
        ) VALUES (
            NEW.id,
            NEW.credits_balance - OLD.credits_balance,
            OLD.credits_balance,
            NEW.credits_balance,
            CASE 
                WHEN NEW.credits_balance > OLD.credits_balance THEN 'purchase'
                ELSE 'usage'
            END
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Create the credit transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    amount INTEGER NOT NULL,
    previous_balance INTEGER NOT NULL,
    new_balance INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add trigger to users table
DROP TRIGGER IF EXISTS log_credit_changes_trigger ON users;
CREATE TRIGGER log_credit_changes_trigger
    AFTER UPDATE OF credits_balance ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_credit_changes(); 