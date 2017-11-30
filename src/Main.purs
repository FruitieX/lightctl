module Main where

import Prelude
import Data.Function.Uncurried (Fn2, mkFn2)
import Data.Foldable (all, elem)

newtype Field = Field (String)
derive newtype instance eqF :: Eq Field
newtype Config = Config (Array Field)
newtype RequiredFields = RequiredFields (Array Field)

validateConfig :: Fn2 Config RequiredFields Boolean
validateConfig = mkFn2 validateConfig'
  where
    validateConfig' (Config config) (RequiredFields fields) = all (fieldInConfig config) fields
    fieldInConfig config field = elem field config
